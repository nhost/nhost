/**
 * Event types yielded while iterating an agent response stream.
 *
 * The AI service sends raw text for content, tool-start, and error events,
 * and JSON objects for tool calls, tool results, approvals, and stop reasons.
 */

/** A chunk of streamed text from the agent's reply. */
export interface ContentDeltaEvent {
  type: 'content_delta';
  content: string;
}

/** Emitted when the agent starts using a tool, before arguments are known. */
export interface ToolUseStartEvent {
  type: 'tool_use_start';
  name: string;
}

/** A complete tool invocation prepared by the agent. */
export interface ToolCallEvent {
  type: 'tool_call';
  toolCallID: string;
  name: string;
  input: unknown;
}

/** The result returned from executing a tool. */
export interface ToolResultEvent {
  type: 'tool_result';
  toolCallID: string;
  toolName: string;
  content: string;
}

/** A tool call denied by the user. */
export interface ToolDeniedEvent {
  type: 'tool_denied';
  toolCallID: string;
  toolName: string;
  content: string;
}

/**
 * Emitted when the agent's response was cut short for a non-normal reason.
 *
 * Currently fires for `max_tokens` (response was truncated at the model's
 * output limit) and `refusal` (the model declined to answer). Normal
 * completions (`end_turn`) and tool-use turns do not emit this event.
 */
export interface StopReasonEvent {
  type: 'stop_reason';
  reason: 'max_tokens' | 'refusal';
}

/** A terminal error reported after an SSE response has started. */
export interface ErrorEvent {
  type: 'error';
  error: string;
}

/**
 * Approval request for one or more pending tool calls.
 *
 * The stream pauses on this event. Call one of the `approve*` / `deny*` /
 * `respond` methods on the event to submit every decision; the same async
 * iterator will then continue yielding events from the resumed response.
 *
 * If you advance the iterator without calling any of the methods, the
 * iterator ends and the agent remains waiting for a decision.
 */
export interface ApprovalRequiredEvent {
  type: 'approval_required';
  toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
    requiresApproval: boolean;
  }>;

  /** Approve every pending tool call in this event. */
  approveAll(): Promise<void>;
  /** Deny every pending tool call in this event. */
  denyAll(): Promise<void>;
  /** Approve the listed tool call ids; any not listed are denied. */
  approve(toolCallIDs: string[]): Promise<void>;
  /** Deny the listed tool call ids; any not listed are approved. */
  deny(toolCallIDs: string[]): Promise<void>;
  /** Submit exactly one decision for every tool call in this event. */
  respond(
    decisions: Array<{ toolCallID: string; approved: boolean }>,
  ): Promise<void>;
}

export type AgentEvent =
  | ContentDeltaEvent
  | ToolUseStartEvent
  | ToolCallEvent
  | ToolResultEvent
  | ApprovalRequiredEvent
  | ToolDeniedEvent
  | StopReasonEvent
  | ErrorEvent;

/** @internal */
export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** @internal */
export const extractToolInput = (raw: unknown): unknown => {
  if (typeof raw !== 'string') {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

/**
 * Maps a JSON SSE payload to a typed event. Raw-text event types are handled
 * before JSON parsing in the stream reader.
 */
export function mapPlainEvent(
  eventType: string,
  parsed: Record<string, unknown>,
): Exclude<
  AgentEvent,
  ApprovalRequiredEvent | ContentDeltaEvent | ErrorEvent | ToolUseStartEvent
> | null {
  switch (eventType) {
    case 'tool_call':
      return {
        type: 'tool_call',
        toolCallID: asString(parsed['id']) ?? '',
        name: asString(parsed['name']) ?? 'unknown',
        input: extractToolInput(parsed['arguments']),
      };

    case 'tool_result':
      return {
        type: 'tool_result',
        toolCallID: asString(parsed['tool_call_id']) ?? '',
        toolName: asString(parsed['tool_name']) ?? 'unknown',
        content: asString(parsed['content']) ?? '',
      };

    case 'tool_denied':
      return {
        type: 'tool_denied',
        toolCallID: asString(parsed['tool_call_id']) ?? '',
        toolName: asString(parsed['tool_name']) ?? 'unknown',
        content: asString(parsed['content']) ?? '',
      };

    case 'stop_reason': {
      const reason = asString(parsed['reason']);
      if (reason !== 'max_tokens' && reason !== 'refusal') {
        return null;
      }
      return { type: 'stop_reason', reason };
    }

    default:
      return null;
  }
}

/** Extracts the tool-call list from a tool_approval_required SSE payload. */
export function parseApprovalToolCalls(
  parsed: Record<string, unknown>,
): ApprovalRequiredEvent['toolCalls'] {
  const raw = parsed['tool_calls'];
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (call): call is Record<string, unknown> =>
        typeof call === 'object' && call !== null,
    )
    .map((call) => ({
      id: asString(call['id']) ?? '',
      name: asString(call['name']) ?? 'unknown',
      input: extractToolInput(call['arguments']),
      requiresApproval: call['requires_approval'] === true,
    }));
}
