import { FetchError, type FetchFunction } from '../fetch';
import {
  type AgentEvent,
  type ApprovalRequiredEvent,
  mapPlainEvent,
  parseApprovalToolCalls,
} from './events';
import type { AgentHistoryMessage } from './history';

/**
 * The stream returned by {@link AgentSession.sendMessage}.
 *
 * Iterate it with `for await ... of` to receive typed agent events. Wrapping
 * `AsyncIterable` in an interface gives us room to add helpers later (e.g.
 * `.collect()`) without a breaking change.
 */
export interface AgentResponseStream extends AsyncIterable<AgentEvent> {}

/**
 * A handle to an existing agent session. Created via
 * {@link AIClient.newAgentSession} or {@link AIClient.agentSession}.
 */
export class AgentSession {
  readonly id: string;
  readonly agentID?: string;
  /**
   * Hasura user id stored on the session row, when one was provided as
   * `x-hasura-user-id` at session-creation time. Useful when resuming a
   * session and wanting to keep impersonating the same user.
   */
  readonly userID?: string;
  /**
   * Messages already persisted on this session. Empty for sessions returned
   * by `newAgentSession`; populated for sessions returned by `resumeSession`.
   *
   * Live events yielded from `sendMessage` are NOT appended here — the caller
   * is responsible for rendering live events alongside this array if needed.
   */
  readonly history: AgentHistoryMessage[];

  private readonly enhancedFetch: FetchFunction;
  private readonly baseURL: string;

  constructor(params: {
    id: string;
    agentID?: string;
    userID?: string;
    baseURL: string;
    enhancedFetch: FetchFunction;
    history?: AgentHistoryMessage[];
  }) {
    this.id = params.id;
    this.agentID = params.agentID;
    this.userID = params.userID;
    this.baseURL = params.baseURL;
    this.enhancedFetch = params.enhancedFetch;
    this.history = params.history ?? [];
  }

  /**
   * Send a message to the agent and stream back typed events. Returns an
   * async-iterable; each iteration yields an {@link AgentEvent}.
   *
   * When an `approval_required` event arrives, the iterator pauses. Call one
   * of the methods on the event (e.g. `event.approveAll()`) before advancing
   * the iterator — the same iterator will then continue with events from the
   * resumed stream.
   */
  sendMessage(message: string, options?: RequestInit): AgentResponseStream {
    const sessionID = this.id;
    const baseURL = this.baseURL;
    const enhancedFetch = this.enhancedFetch;

    const messagesURL = `${baseURL}/agents/sessions/${sessionID}/messages`;
    const approveURL = `${baseURL}/agents/sessions/${sessionID}/approve-tools`;

    const post = (url: string, body: unknown): Promise<Response> =>
      enhancedFetch(url, {
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(body),
      });

    return iterateAgentStream(
      () => post(messagesURL, { message }),
      (decisions) => post(approveURL, { decisions }),
    );
  }
}

function parseSSEPayload(
  eventType: string,
  data: string,
): { parsed: Record<string, unknown> | null; event: AgentEvent | null } {
  try {
    const value: unknown = JSON.parse(data);
    if (value && typeof value === 'object') {
      return {
        parsed: value as Record<string, unknown>,
        event: null,
      };
    }
    if (eventType === 'tool_use_start' && typeof value === 'string') {
      return {
        parsed: null,
        event: { type: 'tool_use_start', name: value },
      };
    }
  } catch {
    if (eventType === 'content_delta') {
      return {
        parsed: null,
        event: { type: 'content_delta', content: data },
      };
    }
    if (eventType === 'tool_use_start') {
      return {
        parsed: null,
        event: { type: 'tool_use_start', name: data },
      };
    }
  }

  return { parsed: null, event: null };
}

/**
 * Builds an AsyncIterable that consumes one or more sequential SSE responses.
 *
 * The first response comes from `initialRequest`. When an `approval_required`
 * event is yielded and the consumer calls one of its decision methods, the
 * generator switches to the approval response and keeps yielding from it.
 */
function iterateAgentStream(
  initialRequest: () => Promise<Response>,
  submitApproval: (
    decisions: Array<{ tool_call_id: string; approved: boolean }>,
  ) => Promise<Response>,
): AgentResponseStream {
  const gen = (async function* (): AsyncGenerator<AgentEvent> {
    let pending: Promise<Response> | null = initialRequest();

    while (pending) {
      const response = await pending;
      pending = null;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let body: unknown = text;
        try {
          body = text ? JSON.parse(text) : text;
        } catch {
          // keep raw text
        }
        throw new FetchError(body, response.status, response.headers);
      }

      let nextRequest: Promise<Response> | null = null;

      const submitDecisions = async (
        decisions: Array<{ toolCallID: string; approved: boolean }>,
      ): Promise<void> => {
        const wireDecisions = decisions.map((d) => ({
          tool_call_id: d.toolCallID,
          approved: d.approved,
        }));
        nextRequest = submitApproval(wireDecisions);
        await nextRequest;
      };

      for await (const { eventType, data } of parseSSEStream(response)) {
        if (eventType === 'done' || data === '') {
          continue;
        }

        const { parsed, event } = parseSSEPayload(eventType, data);
        if (event) {
          yield event;
          continue;
        }
        if (!parsed) {
          continue;
        }

        if (eventType === 'tool_approval_required') {
          const toolCalls = parseApprovalToolCalls(parsed);
          const approve = (ids: string[]) => {
            const set = new Set(ids);
            return submitDecisions(
              toolCalls.map((c) => ({
                toolCallID: c.id,
                approved: set.has(c.id),
              })),
            );
          };
          const deny = (ids: string[]) => {
            const set = new Set(ids);
            return submitDecisions(
              toolCalls.map((c) => ({
                toolCallID: c.id,
                approved: !set.has(c.id),
              })),
            );
          };
          const event: ApprovalRequiredEvent = {
            type: 'approval_required',
            toolCalls,
            approveAll: () =>
              submitDecisions(
                toolCalls.map((c) => ({ toolCallID: c.id, approved: true })),
              ),
            denyAll: () =>
              submitDecisions(
                toolCalls.map((c) => ({ toolCallID: c.id, approved: false })),
              ),
            approve,
            deny,
            respond: submitDecisions,
          };
          yield event;
          continue;
        }

        const typed = mapPlainEvent(eventType, parsed);
        if (typed) {
          yield typed;
        }
      }

      pending = nextRequest;
    }
  })();

  return {
    [Symbol.asyncIterator]() {
      return gen;
    },
  };
}

/**
 * Parses an SSE stream from a fetch Response into `{ eventType, data }`
 * records, following the WHATWG SSE spec: an event is dispatched on a blank
 * line, multiple `data:` fields within an event are joined with `\n`, and
 * `event:` sets the type for the next dispatch.
 */
async function* parseSSEStream(
  response: Response,
): AsyncGenerator<{ eventType: string; data: string }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response has no readable body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let currentEventType = '';
  let dataBuffer = '';
  let hasData = false;

  const dispatch = (): { eventType: string; data: string } | null => {
    if (!hasData) {
      currentEventType = '';
      return null;
    }
    const eventType = currentEventType;
    const data = dataBuffer;
    currentEventType = '';
    dataBuffer = '';
    hasData = false;
    return { eventType, data };
  };

  const consumeFieldValue = (raw: string): string =>
    raw.startsWith(' ') ? raw.slice(1) : raw;

  try {
    while (true) {
      const { done, value } = await reader.read();

      let lines: string[];
      if (done) {
        buffer += decoder.decode();
        lines = buffer.length > 0 ? buffer.split('\n') : [];
        buffer = '';
      } else {
        buffer += decoder.decode(value, { stream: true });
        const split = buffer.split('\n');
        buffer = split.pop() ?? '';
        lines = split;
      }

      for (const rawLine of lines) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

        if (line === '') {
          const event = dispatch();
          if (event) {
            yield event;
          }
          continue;
        }

        if (line.startsWith(':')) {
          continue;
        }

        const colonIdx = line.indexOf(':');
        const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
        const rawValue = colonIdx === -1 ? '' : line.slice(colonIdx + 1);
        const fieldValue = consumeFieldValue(rawValue);

        if (field === 'event') {
          currentEventType = fieldValue;
        } else if (field === 'data') {
          dataBuffer = hasData ? `${dataBuffer}\n${fieldValue}` : fieldValue;
          hasData = true;
        }
      }

      if (done) {
        const final = dispatch();
        if (final) {
          yield final;
        }
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
