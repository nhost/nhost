/**
 * Event types yielded while iterating an agent response stream.
 *
 * The agent service streams Server-Sent Events; this module defines the typed
 * shape we surface to consumers. Field-name fallbacks (e.g. `id ?? tool_call_id`)
 * mirror the dashboard's parsing logic so SDK and dashboard accept the same
 * server payloads.
 */

/** A chunk of streamed text from the agent's reply. */
export interface ContentDeltaEvent {
  type: 'content_delta';
  content: string;
}

/** Emitted when the agent starts using a tool, before arguments are known. */
export interface ToolUseStartEvent {
  type: 'tool_use_start';
  toolCallID?: string;
  name: string;
}

/** A complete tool invocation prepared by the agent. */
export interface ToolCallEvent {
  type: 'tool_call';
  toolCallID?: string;
  name: string;
  input: unknown;
}

/** The result returned from executing a tool. */
export interface ToolResultEvent {
  type: 'tool_result';
  toolCallID?: string;
  toolName: string;
  content: unknown;
}

/** A tool call that was denied either by policy or by a previous approval response. */
export interface ToolDeniedEvent {
  type: 'tool_denied';
  toolName?: string;
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

/** An error event from the agent service. */
export interface ErrorEvent {
  type: 'error';
  error: string;
}

/**
 * Approval request for one or more pending tool calls.
 *
 * The stream pauses on this event. Call one of the `approve*` / `deny*` /
 * `respond` methods on the event to submit a decision; the same async
 * iterator will then continue yielding events from the resumed stream.
 *
 * If you advance the iterator without calling any of the methods, the
 * iterator ends — the agent is left waiting for a decision.
 */
export interface ApprovalRequiredEvent {
  type: 'approval_required';
  toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;

  /** Approve every pending tool call in this event. */
  approveAll(): Promise<void>;
  /** Deny every pending tool call in this event. */
  denyAll(): Promise<void>;
  /** Approve the listed tool call ids; any not listed are denied. */
  approve(toolCallIDs: string[]): Promise<void>;
  /** Deny the listed tool call ids; any not listed are approved. */
  deny(toolCallIDs: string[]): Promise<void>;
  /** Submit explicit per-tool decisions. */
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

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

const extractToolInput = (raw: unknown): unknown => {
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
 * Maps a parsed SSE payload to a typed event, excluding `approval_required`
 * (which needs a callback to wire up the approval methods — see session.ts).
 *
 * Returns `null` for unknown event types so callers can ignore them.
 */
export function mapPlainEvent(
  eventType: string,
  parsed: Record<string, unknown>,
): Exclude<AgentEvent, ApprovalRequiredEvent> | null {
  switch (eventType) {
    case 'content_delta':
      return {
        type: 'content_delta',
        content: asString(parsed['content']) ?? '',
      };

    case 'tool_use_start':
      return {
        type: 'tool_use_start',
        toolCallID:
          asString(parsed['id']) ??
          asString(parsed['tool_call_id']) ??
          asString(parsed['call_id']),
        name: asString(parsed['name']) ?? 'unknown',
      };

    case 'tool_call':
      return {
        type: 'tool_call',
        toolCallID:
          asString(parsed['id']) ??
          asString(parsed['tool_call_id']) ??
          asString(parsed['call_id']),
        name: asString(parsed['name']) ?? 'unknown',
        input: extractToolInput(parsed['arguments'] ?? parsed['input']),
      };

    case 'tool_result':
      return {
        type: 'tool_result',
        toolCallID: asString(parsed['tool_call_id']) ?? asString(parsed['id']),
        toolName: asString(parsed['tool_name']) ?? 'tool',
        content: parsed['content'],
      };

    case 'tool_denied':
      return {
        type: 'tool_denied',
        toolName: asString(parsed['tool_name']),
      };

    case 'stop_reason': {
      const reason = asString(parsed['reason']);
      if (reason !== 'max_tokens' && reason !== 'refusal') {
        return null;
      }
      return { type: 'stop_reason', reason };
    }

    case 'error':
      return {
        type: 'error',
        error: asString(parsed['error']) ?? 'Unknown error',
      };

    default:
      return null;
  }
}

/** Extracts the tool-call list from an approval_required SSE payload. */
export function parseApprovalToolCalls(
  parsed: Record<string, unknown>,
): ApprovalRequiredEvent['toolCalls'] {
  const raw = parsed['tool_calls'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (c): c is Record<string, unknown> => typeof c === 'object' && c !== null,
    )
    .map((call) => ({
      id: asString(call['id']) ?? '',
      name: asString(call['name']) ?? 'unknown',
      input: extractToolInput(call['arguments'] ?? call['input']),
    }));
}
