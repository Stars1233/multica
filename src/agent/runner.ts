import { Agent as PiAgentCore, type AgentEvent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { v7 as uuidv7 } from "uuid";
import type { AgentOptions, AgentRunResult } from "./types.js";
import { createAgentOutput } from "./output.js";
import { resolveModel, resolveTools } from "./tools.js";
import { SessionManager } from "./session/session-manager.js";
import { ProfileManager } from "./profile/index.js";
import { SkillManager } from "./skills/index.js";
import {
  checkContextWindow,
  DEFAULT_CONTEXT_TOKENS,
  type ContextWindowGuardResult,
} from "./context-window/index.js";

/**
 * Get API Key based on provider.
 * Priority: explicit key > provider-specific env var > generic env var format.
 */
function resolveApiKey(provider: string, explicitKey?: string): string | undefined {
  if (explicitKey) return explicitKey;

  const providerEnvMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
    "google-genai": "GOOGLE_API_KEY",
    kimi: "MOONSHOT_API_KEY",
    "kimi-coding": "MOONSHOT_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    groq: "GROQ_API_KEY",
    mistral: "MISTRAL_API_KEY",
    together: "TOGETHER_API_KEY",
  };

  const envVar = providerEnvMap[provider];
  if (envVar) {
    return process.env[envVar];
  }

  // Try generic format: PROVIDER_API_KEY
  const normalizedProvider = provider.toUpperCase().replace(/-/g, "_");
  return process.env[`${normalizedProvider}_API_KEY`];
}

/**
 * Get Base URL based on provider.
 * Priority: explicit URL > provider-specific env var > generic env var format.
 */
function resolveBaseUrl(provider: string, explicitUrl?: string): string | undefined {
  if (explicitUrl) return explicitUrl;

  const providerEnvMap: Record<string, string> = {
    openai: "OPENAI_BASE_URL",
    anthropic: "ANTHROPIC_BASE_URL",
    google: "GOOGLE_BASE_URL",
    "google-genai": "GOOGLE_BASE_URL",
    kimi: "MOONSHOT_BASE_URL",
    "kimi-coding": "MOONSHOT_BASE_URL",
    deepseek: "DEEPSEEK_BASE_URL",
    groq: "GROQ_BASE_URL",
    mistral: "MISTRAL_BASE_URL",
    together: "TOGETHER_BASE_URL",
  };

  const envVar = providerEnvMap[provider];
  if (envVar) {
    return process.env[envVar];
  }

  // Try generic format: PROVIDER_BASE_URL
  const normalizedProvider = provider.toUpperCase().replace(/-/g, "_");
  return process.env[`${normalizedProvider}_BASE_URL`];
}

/**
 * Get Model ID based on provider.
 * Priority: explicit model > provider-specific env var > generic env var format.
 */
function resolveModelId(provider: string, explicitModel?: string): string | undefined {
  if (explicitModel) return explicitModel;

  const providerEnvMap: Record<string, string> = {
    openai: "OPENAI_MODEL",
    anthropic: "ANTHROPIC_MODEL",
    google: "GOOGLE_MODEL",
    "google-genai": "GOOGLE_MODEL",
    kimi: "MOONSHOT_MODEL",
    "kimi-coding": "MOONSHOT_MODEL",
    deepseek: "DEEPSEEK_MODEL",
    groq: "GROQ_MODEL",
    mistral: "MISTRAL_MODEL",
    together: "TOGETHER_MODEL",
  };

  const envVar = providerEnvMap[provider];
  if (envVar) {
    return process.env[envVar];
  }

  // Try generic format: PROVIDER_MODEL
  const normalizedProvider = provider.toUpperCase().replace(/-/g, "_");
  return process.env[`${normalizedProvider}_MODEL`];
}

export class Agent {
  private readonly agent: PiAgentCore;
  private readonly output;
  private readonly session: SessionManager;
  private readonly profile?: ProfileManager;
  private readonly skillManager?: SkillManager;
  private readonly contextWindowGuard: ContextWindowGuardResult;
  private readonly debug: boolean;

  /** Current session ID */
  readonly sessionId: string;

  constructor(options: AgentOptions = {}) {
    const stdout = options.logger?.stdout ?? process.stdout;
    const stderr = options.logger?.stderr ?? process.stderr;
    this.output = createAgentOutput({ stdout, stderr });
    this.debug = options.debug ?? false;

    // Resolve provider and model from options > env vars > defaults
    const resolvedProvider = options.provider ?? process.env.LLM_PROVIDER ?? "kimi-coding";
    const resolvedModel = resolveModelId(resolvedProvider, options.model);
    const apiKey = resolveApiKey(resolvedProvider, options.apiKey);

    this.agent = new PiAgentCore(
      apiKey
        ? { getApiKey: (_provider: string) => apiKey }
        : {},
    );

    // Load Agent Profile (if profileId is specified)
    let systemPrompt: string | undefined;
    if (options.profileId) {
      this.profile = new ProfileManager({
        profileId: options.profileId,
        baseDir: options.profileBaseDir,
      });
      systemPrompt = this.profile.buildSystemPrompt();
    } else if (options.systemPrompt) {
      // Use provided systemPrompt directly
      systemPrompt = options.systemPrompt;
    }

    // Initialize SkillManager (enabled by default)
    if (options.enableSkills !== false) {
      this.skillManager = new SkillManager({
        profileId: options.profileId,
        profileBaseDir: options.profileBaseDir,
        extraDirs: options.extraSkillDirs,
      });

      // Append skills prompt to system prompt
      const skillsPrompt = this.skillManager.buildSkillsPrompt();
      if (skillsPrompt) {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${skillsPrompt}` : skillsPrompt;
      }
    }

    // Set the combined system prompt
    if (systemPrompt) {
      this.agent.setSystemPrompt(systemPrompt);
    }

    this.sessionId = options.sessionId ?? uuidv7();

    // 解析 model（用于获取 context window）
    const storedMeta = (() => {
      // 临时创建 session 获取 meta，避免循环依赖
      const tempSession = new SessionManager({ sessionId: this.sessionId });
      return tempSession.getMeta();
    })();

    const effectiveProvider = resolvedModel ? resolvedProvider : (options.provider ?? storedMeta?.provider);
    const effectiveModel = resolvedModel ?? options.model ?? storedMeta?.model;
    let model = resolveModel({ ...options, provider: effectiveProvider, model: effectiveModel });

    if (!model) {
      throw new Error(
        `Unknown model: provider="${effectiveProvider}", model="${effectiveModel}". ` +
        `Check your LLM_PROVIDER and model env vars (e.g. OPENAI_MODEL). ` +
        `For OpenRouter, use LLM_PROVIDER=openrouter.`,
      );
    }

    // Override base URL if provided via options or environment variable
    const baseUrl = resolveBaseUrl(model.provider, options.baseUrl);
    if (baseUrl) {
      model = { ...model, baseUrl };
    }

    // === Context Window Guard ===
    this.contextWindowGuard = checkContextWindow({
      modelContextWindow: model.contextWindow,
      configContextTokens: options.contextWindowTokens,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    // 警告：context window 较小
    if (this.contextWindowGuard.shouldWarn) {
      stderr.write(
        `[Context Window Guard] WARNING: Low context window: ${this.contextWindowGuard.tokens} tokens (source: ${this.contextWindowGuard.source})\n`,
      );
    }

    // 阻止：context window 太小
    if (this.contextWindowGuard.shouldBlock) {
      throw new Error(
        `[Context Window Guard] Context window too small: ${this.contextWindowGuard.tokens} tokens. ` +
          `Minimum required: 16,000 tokens. Please use a model with a larger context window.`,
      );
    }

    // 确定 compaction 模式
    const compactionMode = options.compactionMode ?? "tokens"; // 默认使用 token 模式

    // 获取 API Key（用于 summary 模式）
    const summaryApiKey = compactionMode === "summary" ? resolveApiKey(model.provider, options.apiKey) : undefined;

    // 创建 SessionManager（带 context window 配置）
    this.session = new SessionManager({
      sessionId: this.sessionId,
      compactionMode,
      // Token 模式参数
      contextWindowTokens: this.contextWindowGuard.tokens,
      systemPrompt,
      reserveTokens: options.reserveTokens,
      targetRatio: options.compactionTargetRatio,
      minKeepMessages: options.minKeepMessages,
      // Summary 模式参数
      model: compactionMode === "summary" ? model : undefined,
      apiKey: summaryApiKey,
      customInstructions: options.summaryInstructions,
    });

    if (!options.thinkingLevel && storedMeta?.thinkingLevel) {
      this.agent.setThinkingLevel(storedMeta.thinkingLevel as any);
    } else if (options.thinkingLevel) {
      this.agent.setThinkingLevel(options.thinkingLevel);
    }

    this.agent.setModel(model);
    this.agent.setTools(resolveTools(options));

    const restoredMessages = this.session.loadMessages();
    if (restoredMessages.length > 0) {
      if (this.debug) {
        console.error(`[debug] Restoring ${restoredMessages.length} messages from session`);
        for (const msg of restoredMessages) {
          const msgAny = msg as any;
          const content = Array.isArray(msgAny.content)
            ? msgAny.content.map((c: any) => c.type || "text").join(", ")
            : typeof msgAny.content;
          console.error(`[debug]   ${msg.role}: ${content}`);
          if (Array.isArray(msgAny.content)) {
            for (const block of msgAny.content) {
              if (block.type === "tool_use") {
                console.error(`[debug]     tool_use id: ${block.id}, name: ${block.name}`);
              }
              if (block.type === "tool_result") {
                console.error(`[debug]     tool_result tool_use_id: ${block.tool_use_id}`);
              }
            }
          }
        }
      }
      this.agent.replaceMessages(restoredMessages);
    }

    this.session.saveMeta({
      provider: this.agent.state.model?.provider,
      model: this.agent.state.model?.id,
      thinkingLevel: this.agent.state.thinkingLevel,
      contextWindowTokens: this.contextWindowGuard.tokens,
    });

    this.agent.subscribe((event: AgentEvent) => {
      this.output.handleEvent(event);
      this.handleSessionEvent(event);
    });
  }

  async run(prompt: string): Promise<AgentRunResult> {
    this.output.state.lastAssistantText = "";
    await this.agent.prompt(prompt);
    return { text: this.output.state.lastAssistantText, error: this.agent.state.error };
  }

  private handleSessionEvent(event: AgentEvent) {
    if (event.type === "message_end") {
      const message = event.message as AgentMessage;
      this.session.saveMessage(message);
      if (message.role === "assistant") {
        void this.maybeCompact();
      }
    }
  }

  private async maybeCompact() {
    const messages = this.agent.state.messages.slice();
    const result = await this.session.maybeCompact(messages);
    if (result?.kept) {
      this.agent.replaceMessages(result.kept);
    }
  }
}
