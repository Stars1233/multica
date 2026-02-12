/**
 * Telegram service for Gateway.
 *
 * Handles Telegram bot interactions via webhook.
 * - New users: prompts to paste a multica://connect link
 * - Connection link: verifies with Hub via RPC, persists to DB
 * - Bound users: routes messages to their Hub agent
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { Bot, webhookCallback } from "grammy";
import type { Context } from "grammy";
import { v7 as uuidv7 } from "uuid";
import { parseConnectionCode } from "@multica/store/connection";
import type { ConnectionInfo } from "@multica/store/connection";
import {
  GatewayEvents,
  RequestAction,
  ResponseAction,
  StreamAction,
  type RoutedMessage,
  type RequestPayload,
  type ResponsePayload,
  type VerifyParams,
  type VerifyResult,
  type DeviceMeta,
} from "@multica/sdk";
import type { StreamPayload } from "@multica/sdk";
import { EventsGateway } from "../events.gateway.js";
import { TelegramUserStore } from "./telegram-user.store.js";
import type { TelegramUser } from "./types.js";

// Minimal Express types for webhook handling
interface ExpressRequest {
  body: unknown;
  header: (name: string) => string | undefined;
}

interface ExpressResponse {
  status: (code: number) => ExpressResponse;
  json: (data: unknown) => void;
  headersSent: boolean;
}

interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const VERIFY_TIMEOUT_MS = 30_000;

@Injectable()
export class TelegramService implements OnModuleInit {
  private static readonly TYPING_TIMEOUT_MS = 60_000; // 1 minute safety cap
  private bot: Bot | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private typingTimers = new Map<string, ReturnType<typeof setInterval>>();

  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(EventsGateway) private readonly eventsGateway: EventsGateway,
    @Inject(TelegramUserStore) private readonly userStore: TelegramUserStore,
  ) {}

  async onModuleInit(): Promise<void> {
    console.log("[TelegramService] onModuleInit starting...");
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) {
      console.log("[TelegramService] No bot token");
      this.logger.warn("TELEGRAM_BOT_TOKEN not set, Telegram webhook disabled");
      return;
    }

    console.log("[TelegramService] Creating bot...");
    this.bot = new Bot(token);
    this.setupHandlers();
    this.logger.log("Telegram bot initialized");
  }

  /** Get grammY webhook callback for Express/NestJS */
  getWebhookCallback(): ((req: ExpressRequest, res: ExpressResponse) => Promise<void>) | null {
    if (!this.bot) return null;

    const secretToken = process.env["TELEGRAM_WEBHOOK_SECRET_TOKEN"];
    if (secretToken) {
      return webhookCallback(this.bot, "express", { secretToken }) as unknown as (
        req: ExpressRequest,
        res: ExpressResponse
      ) => Promise<void>;
    }
    return webhookCallback(this.bot, "express") as unknown as (
      req: ExpressRequest,
      res: ExpressResponse
    ) => Promise<void>;
  }

  /** Check if Telegram bot is configured */
  isConfigured(): boolean {
    return this.bot !== null;
  }

  /** Send message to a Telegram user by device ID */
  async sendToTelegram(deviceId: string, text: string): Promise<void> {
    if (!this.bot) return;

    const user = await this.userStore.findByDeviceId(deviceId);
    if (!user) {
      this.logger.warn(`Telegram user not found for device: deviceId=${deviceId}`);
      return;
    }

    try {
      await this.bot.api.sendMessage(Number(user.telegramUserId), text);
      this.logger.debug(`Sent message to Telegram: telegramUserId=${user.telegramUserId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send Telegram message: deviceId=${deviceId}, error=${message}`);
    }
  }

  /** Setup bot message handlers */
  private setupHandlers(): void {
    if (!this.bot) return;

    this.bot.on("message:text", async (ctx) => {
      await this.handleTextMessage(ctx);
    });
  }

  /** Handle incoming text message */
  private async handleTextMessage(ctx: Context): Promise<void> {
    const msg = ctx.message;
    if (!msg || !msg.text) return;

    const telegramUserId = String(msg.from?.id);
    const text = msg.text.trim();

    this.logger.debug(`Received Telegram message: telegramUserId=${telegramUserId}, text=${text.slice(0, 50)}`);

    // Connection link — always handle, even for already-bound users (re-binding)
    if (text.startsWith("multica://connect?")) {
      await this.handleConnectionLink(ctx, telegramUserId, text);
      return;
    }

    // Check if user is bound
    const user = await this.userStore.findByTelegramUserId(telegramUserId);

    if (user) {
      await this.routeToHub(user, text, ctx);
      return;
    }

    // New user without connection link
    await ctx.reply(
      "Welcome to Multica!\n\n" +
      "To get started, open the Multica Desktop app, generate a Connection Link, " +
      "and paste it here.\n\n" +
      "The link looks like:\nmultica://connect?gateway=...&hub=...&agent=...&token=...&exp=..."
    );
  }

  /** Handle a multica://connect? connection link */
  private async handleConnectionLink(ctx: Context, telegramUserId: string, text: string): Promise<void> {
    const msg = ctx.message;

    // 1. Parse and validate the connection link
    let connectionInfo: ConnectionInfo;
    try {
      connectionInfo = parseConnectionCode(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid connection link";
      await ctx.reply(`Connection failed: ${message}\n\nPlease generate a new link and try again.`);
      return;
    }

    // 2. Check Hub is online
    if (!this.eventsGateway.isDeviceRegistered(connectionInfo.hubId)) {
      await ctx.reply(
        "Connection failed: Hub is not online.\n\n" +
        "Make sure the Multica Desktop app is running and connected to the Gateway, then try again."
      );
      return;
    }

    // 3. Unregister old virtual device if user is re-binding
    const existingUser = await this.userStore.findByTelegramUserId(telegramUserId);
    if (existingUser && this.eventsGateway.isDeviceRegistered(existingUser.deviceId)) {
      this.eventsGateway.unregisterVirtualDevice(existingUser.deviceId);
    }

    // 4. Generate device ID and register virtual device
    const deviceId = `tg-${uuidv7()}`;
    this.registerVirtualDeviceForUser(deviceId, telegramUserId);

    // 5. Send verify RPC
    try {
      await ctx.reply("Connecting... Please approve the connection on your Desktop app.");

      const result = await this.sendVerifyRpc(
        deviceId,
        connectionInfo.hubId,
        connectionInfo.token,
        {
          platform: "telegram",
          clientName: msg?.from?.username
            ? `Telegram @${msg.from.username}`
            : `Telegram ${msg?.from?.first_name ?? telegramUserId}`,
        }
      );

      // 6. Save to DB
      await this.userStore.upsert({
        telegramUserId,
        hubId: connectionInfo.hubId,
        agentId: connectionInfo.agentId,
        deviceId,
        telegramUsername: msg?.from?.username,
        telegramFirstName: msg?.from?.first_name,
        telegramLastName: msg?.from?.last_name,
      });

      await ctx.reply(
        "Connected successfully!\n\n" +
        `Hub: ${result.hubId}\n` +
        `Agent: ${result.agentId}\n\n` +
        "You can now send messages to interact with your agent."
      );

      this.logger.log(`Telegram user verified: telegramUserId=${telegramUserId}, hubId=${connectionInfo.hubId}, deviceId=${deviceId}`);
    } catch (error) {
      // Cleanup virtual device on failure
      this.eventsGateway.unregisterVirtualDevice(deviceId);
      // Reject all pending requests for this device
      this.cleanupPendingRequests();

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("REJECTED")) {
        await ctx.reply("Connection rejected.\n\nThe connection was declined on the Desktop app.");
      } else if (message.includes("timed out")) {
        await ctx.reply("Connection timed out.\n\nPlease try again and approve the connection on your Desktop app within 30 seconds.");
      } else {
        await ctx.reply(`Connection failed: ${message}\n\nPlease try again.`);
      }

      this.logger.warn(`Telegram verify failed: telegramUserId=${telegramUserId}, error=${message}`);
    }
  }

  /** Send a verify RPC to Hub via the virtual device */
  private sendVerifyRpc(
    deviceId: string,
    hubId: string,
    token: string,
    meta: DeviceMeta,
  ): Promise<VerifyResult> {
    return new Promise<VerifyResult>((resolve, reject) => {
      const requestId = uuidv7();

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Verify request timed out"));
      }, VERIFY_TIMEOUT_MS);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      const payload: RequestPayload<VerifyParams> = {
        requestId,
        method: "verify",
        params: { token, meta },
      };

      const message: RoutedMessage<RequestPayload<VerifyParams>> = {
        id: uuidv7(),
        uid: null,
        from: deviceId,
        to: hubId,
        action: RequestAction,
        payload,
      };

      const sent = this.eventsGateway.routeFromVirtualDevice(message);
      if (!sent) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timer);
        reject(new Error("Failed to route verify request to Hub"));
      }
    });
  }

  /** Route a regular chat message to the user's Hub agent */
  private async routeToHub(user: TelegramUser, text: string, ctx: Context): Promise<void> {
    // Ensure Hub is online
    if (!this.eventsGateway.isDeviceRegistered(user.hubId)) {
      await ctx.reply(
        "Your Hub is currently offline.\n\n" +
        "Make sure the Multica Desktop app is running and connected to the Gateway."
      );
      return;
    }

    // Ensure virtual device is registered (may have been lost on gateway restart)
    if (!this.eventsGateway.isDeviceRegistered(user.deviceId)) {
      this.registerVirtualDeviceForUser(user.deviceId, user.telegramUserId);
    }

    // Send message to Hub
    const message: RoutedMessage = {
      id: uuidv7(),
      uid: null,
      from: user.deviceId,
      to: user.hubId,
      action: "message",
      payload: { agentId: user.agentId, content: text },
    };

    const sent = this.eventsGateway.routeFromVirtualDevice(message);
    if (!sent) {
      await ctx.reply("Failed to send message. Please try again.");
      return;
    }

    this.logger.debug(`Routed message to Hub: deviceId=${user.deviceId}, hubId=${user.hubId}, agentId=${user.agentId}`);
  }

  /** Register a virtual device with a sendCallback that handles RPC responses, stream events, and messages */
  private registerVirtualDeviceForUser(deviceId: string, telegramUserId: string): void {
    this.eventsGateway.registerVirtualDevice(deviceId, {
      sendCallback: (_event: string, data: unknown) => {
        const msg = data as RoutedMessage;
        if (!msg || !msg.action) return;

        // RPC response — resolve/reject pending request
        if (msg.action === ResponseAction) {
          const response = msg.payload as ResponsePayload;
          const pending = this.pendingRequests.get(response.requestId);
          if (pending) {
            this.pendingRequests.delete(response.requestId);
            clearTimeout(pending.timer);
            if (response.ok) {
              pending.resolve(response.payload);
            } else {
              pending.reject(new Error(`RPC error [${response.error.code}]: ${response.error.message}`));
            }
          }
          return;
        }

        // Stream event — typing indicator + extract text content for Telegram
        if (msg.action === StreamAction) {
          const streamPayload = msg.payload as StreamPayload;
          const event = streamPayload?.event;
          if (!event || !("type" in event)) return;

          // Start typing when LLM begins generating
          if (event.type === "message_start") {
            this.startTyping(telegramUserId);
            return;
          }

          // Stop typing + send text on message_end
          if (event.type === "message_end") {
            this.stopTyping(telegramUserId);
            const agentMsg = (event as { message?: { content?: Array<{ type: string; text?: string }> } }).message;
            if (agentMsg?.content) {
              const textContent = agentMsg.content
                .filter((c) => c.type === "text" && c.text)
                .map((c) => c.text!)
                .join("");
              if (textContent) {
                this.sendToTelegram(deviceId, textContent);
              }
            }
            return;
          }

          // Stop typing on error
          if (event.type === "agent_error") {
            this.stopTyping(telegramUserId);
            return;
          }

          return;
        }

        // Regular message (e.g., "message" action from Hub)
        if (msg.action === "message") {
          const payload = msg.payload as { content?: string; agentId?: string };
          if (payload?.content) {
            this.sendToTelegram(deviceId, payload.content);
          }
          return;
        }

        // Error messages
        if (msg.action === "error") {
          this.stopTyping(telegramUserId);
          const payload = msg.payload as { message?: string; code?: string };
          if (payload?.message) {
            this.sendToTelegram(deviceId, `Error: ${payload.message}`);
          }
        }
      },
    });
  }

  /** Start sending "typing" indicator to Telegram at regular intervals */
  private startTyping(telegramUserId: string): void {
    if (this.typingTimers.has(telegramUserId)) return;
    const chatId = Number(telegramUserId);
    const send = () => {
      void this.bot?.api.sendChatAction(chatId, "typing").catch(() => {});
    };
    send();
    const interval = setInterval(send, 5000);
    this.typingTimers.set(telegramUserId, interval);

    // Safety timeout: auto-stop if no message_end/agent_error arrives
    setTimeout(() => {
      if (this.typingTimers.get(telegramUserId) === interval) {
        this.stopTyping(telegramUserId);
      }
    }, TelegramService.TYPING_TIMEOUT_MS);
  }

  /** Stop the "typing" indicator for a Telegram user */
  private stopTyping(telegramUserId: string): void {
    const timer = this.typingTimers.get(telegramUserId);
    if (timer) {
      clearInterval(timer);
      this.typingTimers.delete(telegramUserId);
    }
  }

  /** Cleanup all pending requests (used on verify failure) */
  private cleanupPendingRequests(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Cleaned up"));
      this.pendingRequests.delete(id);
    }
  }
}
