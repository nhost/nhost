/**
 * This is the main module to interact with Nhost's AI agents.
 * Typically you would use this module via the main [Nhost client](/reference/javascript/nhost-js/main#createclient)
 * but you can also use it directly if you have a specific use case.
 *
 * ## Import
 *
 * ```ts
 * import { createClient } from '@nhost/nhost-js';
 * import type { AgentEvent } from '@nhost/nhost-js/ai';
 * ```
 *
 * ## Usage
 *
 * Create a session for an existing agent and stream typed events back from a
 * `sendMessage` call:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:88-106}
 *
 * ## Tool approval
 *
 * When the agent has tools configured with `require_approval`, the stream
 * will yield an `approval_required` event. The event carries methods to
 * approve or deny the pending tool calls; calling one of them resumes the
 * same iterator with events from the continued stream:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:167-182}
 *
 * ## Resuming an existing session
 *
 * Use `resumeSession` to fetch the stored messages of a session and continue
 * the conversation. The returned session has a populated `history` field
 * plus the same `sendMessage` as a new session:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:259-284}
 *
 * @module ai
 * @packageDocumentation
 */

export type {
  AgentEvent,
  AgentHistoryMessage,
  AgentResponseStream,
  ApprovalRequiredEvent,
  AssistantHistoryMessage,
  Client,
  ContentDeltaEvent,
  ErrorEvent,
  NewAgentSessionInput,
  ResumeSessionInput,
  StopReasonEvent,
  ToolCallEvent,
  ToolCallHistoryMessage,
  ToolDeniedEvent,
  ToolResultEvent,
  ToolResultHistoryMessage,
  ToolUseStartEvent,
  UserHistoryMessage,
} from './client';
export { AgentSession, createAPIClient } from './client';
