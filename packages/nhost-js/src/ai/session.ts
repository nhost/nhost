import { FetchError, type FetchFunction } from '../fetch';
import {
  type AgentEvent,
  type ApprovalRequiredEvent,
  mapPlainEvent,
  parseApprovalToolCalls,
} from './events';
import type { AgentHistoryMessage } from './history';

/** The stream returned by {@link AgentSession.sendMessage}. */
export interface AgentResponseStream extends AsyncIterable<AgentEvent> {}

interface ApprovalDecision {
  toolCallID: string;
  approved: boolean;
}

interface WireApprovalDecision {
  tool_call_id: string;
  approved: boolean;
}

type StreamRequest = (signal: AbortSignal) => Promise<Response>;

/**
 * A handle to an existing agent session. Create one with `Client.newAgentSession`,
 * `Client.resumeSession`, or `Client.agentSession`.
 */
export class AgentSession {
  readonly id: string;
  readonly agentID?: string;
  /** Hasura user id stored on the session row, when available. */
  readonly userID?: string;
  /**
   * Messages already persisted on this session. Empty for sessions returned
   * by `newAgentSession`; populated for sessions returned by `resumeSession`.
   * Live events from `sendMessage` are not appended to this array.
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
   * Send a message to the agent and stream back typed events.
   *
   * When an `approval_required` event arrives, call one of its decision
   * methods before advancing the iterator. The same iterator then continues
   * with events from the approval response.
   */
  sendMessage(message: string, options?: RequestInit): AgentResponseStream {
    const messagesURL = `${this.baseURL}/agents/sessions/${this.id}/messages`;
    const approveURL = `${this.baseURL}/agents/sessions/${this.id}/approve-tools`;

    const post = (
      url: string,
      body: unknown,
      signal: AbortSignal,
    ): Promise<Response> => {
      const headers = new Headers(options?.headers);
      headers.set('Content-Type', 'application/json');

      return this.enhancedFetch(url, {
        ...options,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    };

    return iterateAgentStream(
      (signal) => post(messagesURL, { message }, signal),
      (decisions, signal) => post(approveURL, { decisions }, signal),
      options?.signal,
    );
  }
}

async function ensureSuccessfulResponse(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  const text = await response.text().catch(() => '');
  let body: unknown = text;

  try {
    body = text ? JSON.parse(text) : text;
  } catch {
    body = text;
  }

  throw new FetchError(body, response.status, response.headers);
}

function parseSSEPayload(eventType: string, data: string): AgentEvent | null {
  if (eventType === 'content_delta') {
    return { type: 'content_delta', content: data };
  }

  if (eventType === 'tool_use_start') {
    return { type: 'tool_use_start', name: data };
  }

  if (eventType === 'error') {
    return { type: 'error', error: data };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return mapPlainEvent(eventType, parsed as Record<string, unknown>);
}

function validateApprovalDecisions(
  toolCalls: ApprovalRequiredEvent['toolCalls'],
  decisions: ApprovalDecision[],
): void {
  const pendingIDs = new Set(toolCalls.map(({ id }) => id));
  const decisionIDs = new Set(decisions.map(({ toolCallID }) => toolCallID));

  if (
    decisions.length !== toolCalls.length ||
    decisionIDs.size !== decisions.length ||
    [...decisionIDs].some((id) => !pendingIDs.has(id)) ||
    [...pendingIDs].some((id) => !decisionIDs.has(id))
  ) {
    throw new Error(
      'Approval decisions must include every pending tool call exactly once',
    );
  }
}

function createApprovalEvent(
  toolCalls: ApprovalRequiredEvent['toolCalls'],
  submitDecisions: (decisions: ApprovalDecision[]) => Promise<void>,
): ApprovalRequiredEvent {
  const respond = async (decisions: ApprovalDecision[]): Promise<void> => {
    validateApprovalDecisions(toolCalls, decisions);
    await submitDecisions(decisions);
  };

  const decideSelected = async (
    selectedIDs: string[],
    selectedApproval: boolean,
  ): Promise<void> => {
    const pendingIDs = new Set(toolCalls.map(({ id }) => id));
    const selected = new Set(selectedIDs);
    if (
      selected.size !== selectedIDs.length ||
      selectedIDs.some((id) => !pendingIDs.has(id))
    ) {
      throw new Error(
        'Selected tool call IDs must be unique and belong to the approval request',
      );
    }

    await respond(
      toolCalls.map(({ id }) => ({
        toolCallID: id,
        approved: selected.has(id) ? selectedApproval : !selectedApproval,
      })),
    );
  };

  return {
    type: 'approval_required',
    toolCalls,
    approveAll: () =>
      respond(toolCalls.map(({ id }) => ({ toolCallID: id, approved: true }))),
    denyAll: () =>
      respond(toolCalls.map(({ id }) => ({ toolCallID: id, approved: false }))),
    approve: (toolCallIDs) => decideSelected(toolCallIDs, true),
    deny: (toolCallIDs) => decideSelected(toolCallIDs, false),
    respond,
  };
}

/** Consumes the initial SSE response and any response created by tool approval. */
function iterateAgentStream(
  initialRequest: StreamRequest,
  submitApproval: (
    decisions: WireApprovalDecision[],
    signal: AbortSignal,
  ) => Promise<Response>,
  externalSignal?: AbortSignal | null,
): AgentResponseStream {
  const gen = (async function* (): AsyncGenerator<AgentEvent> {
    const controller = new AbortController();
    const forwardAbort = (): void => controller.abort(externalSignal?.reason);

    if (externalSignal?.aborted) {
      forwardAbort();
    } else {
      externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    }

    let continuationResponse: Response | null = null;

    try {
      let pending: Promise<Response> | null = initialRequest(
        controller.signal,
      ).then(ensureSuccessfulResponse);

      while (pending) {
        const response = await pending;
        pending = null;

        if (response === continuationResponse) {
          continuationResponse = null;
        }

        let nextRequest: Promise<Response> | null = null;
        let decisionSubmitted = false;

        const submitDecisions = async (
          decisions: ApprovalDecision[],
        ): Promise<void> => {
          if (decisionSubmitted) {
            throw new Error(
              'Tool approval decisions have already been submitted',
            );
          }
          decisionSubmitted = true;

          const wireDecisions = decisions.map(({ toolCallID, approved }) => ({
            tool_call_id: toolCallID,
            approved,
          }));

          try {
            nextRequest = submitApproval(wireDecisions, controller.signal)
              .then(ensureSuccessfulResponse)
              .then((nextResponse) => {
                continuationResponse = nextResponse;
                return nextResponse;
              });

            await nextRequest;
          } catch (error: unknown) {
            decisionSubmitted = false;
            nextRequest = null;
            continuationResponse = null;
            throw error;
          }
        };

        for await (const { eventType, data } of parseSSEStream(response)) {
          if (eventType === 'done') {
            continue;
          }

          if (eventType === 'tool_approval_required') {
            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            if (
              parsed &&
              typeof parsed === 'object' &&
              !Array.isArray(parsed)
            ) {
              yield createApprovalEvent(
                parseApprovalToolCalls(parsed as Record<string, unknown>),
                submitDecisions,
              );
            }
            continue;
          }

          const event = parseSSEPayload(eventType, data);
          if (event) {
            yield event;
          }
        }

        pending = nextRequest;
      }
    } finally {
      externalSignal?.removeEventListener('abort', forwardAbort);
      controller.abort();
      const responseToCancel = continuationResponse as Response | null;
      await responseToCancel?.body?.cancel().catch(() => undefined);
    }
  })();

  return {
    [Symbol.asyncIterator]() {
      return gen;
    },
  };
}

interface LineBreak {
  index: number;
  length: number;
}

function findLineBreak(value: string, endOfStream: boolean): LineBreak | null {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\n') {
      return { index, length: 1 };
    }

    if (value[index] !== '\r') {
      continue;
    }

    if (index + 1 < value.length) {
      return { index, length: value[index + 1] === '\n' ? 2 : 1 };
    }

    return endOfStream ? { index, length: 1 } : null;
  }

  return null;
}

/** Parses a fetch response according to the WHATWG event-stream line format. */
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
  let dataLines: string[] = [];

  const dispatch = (): { eventType: string; data: string } | null => {
    if (dataLines.length === 0) {
      currentEventType = '';
      return null;
    }

    const event = {
      eventType: currentEventType || 'message',
      data: dataLines.join('\n'),
    };
    currentEventType = '';
    dataLines = [];
    return event;
  };

  const consumeLine = (
    line: string,
  ): { eventType: string; data: string } | null => {
    if (line === '') {
      return dispatch();
    }

    if (line.startsWith(':')) {
      return null;
    }

    const colonIndex = line.indexOf(':');
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const rawValue = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'event') {
      currentEventType = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }

    return null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });

      let lineBreak = findLineBreak(buffer, done);
      while (lineBreak) {
        const line = buffer.slice(0, lineBreak.index);
        buffer = buffer.slice(lineBreak.index + lineBreak.length);

        const event = consumeLine(line);
        if (event) {
          yield event;
        }

        lineBreak = findLineBreak(buffer, done);
      }

      if (!done) {
        continue;
      }

      if (buffer) {
        const event = consumeLine(buffer);
        if (event) {
          yield event;
        }
      }

      const finalEvent = dispatch();
      if (finalEvent) {
        yield finalEvent;
      }
      break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
