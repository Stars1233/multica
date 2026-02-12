/**
 * @multica/core - Core package
 *
 * Contains: Agent, Hub, Channels, Cron, Heartbeat, Media, Client
 */

// Re-export from submodules
export * from './agent/index.js'
export * from './hub/index.js'
export * from './channels/index.js'
export * from './cron/index.js'
export * from './heartbeat/index.js'
export * from './media/index.js'
export * from './app-state.js'

// Client exports (selective to avoid conflicts with agent/events)
export {
  GatewayClient,
  type ConnectionState,
  type RoutedMessage,
  type SendErrorResponse,
  HelloAction,
  HelloResponseAction,
  RequestAction,
  ResponseAction,
  StreamAction,
  ExecApprovalRequestAction,
  type HelloPayload,
  type HelloResponsePayload,
  type RequestPayload,
  type ResponsePayload,
  type ResponseSuccessPayload,
  type ResponseErrorPayload,
  type StreamPayload,
  type ExecApprovalRequestPayload,
  type ApprovalDecision,
  isResponseSuccess,
  isResponseError,
  type AgentMessageItem,
  DEFAULT_MESSAGES_LIMIT,
  type GetAgentMessagesParams,
  type GetAgentMessagesResult,
  type GetHubInfoResult,
  type ListAgentsResult,
  type CreateAgentParams,
  type CreateAgentResult,
  type DeleteAgentParams,
  type DeleteAgentResult,
  type UpdateGatewayParams,
  type UpdateGatewayResult,
  type VerifyParams,
  type VerifyResult,
  type ResolveExecApprovalParams,
  type ResolveExecApprovalResult,
  type ContentBlock,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type ImageContent,
  extractThinkingFromEvent,
} from './client/index.js'
