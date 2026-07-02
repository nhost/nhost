/**
 * Typed representation of messages already persisted in an agent session.
 *
 * One row in the `graphiteAgentMessages` table may carry both assistant text
 * and a list of tool calls; to keep the history iterable with the same
 * `switch` as live events, we flatten each DB row into one or more
 * {@link AgentHistoryMessage}s — mirroring the dashboard's `messagesToEntries`.
 */

import type { RawAgentMessage } from './queries';

export interface UserHistoryMessage {
  type: 'user';
  id: string;
  content: string;
  createdAt: string;
}

export interface AssistantHistoryMessage {
  type: 'assistant';
  id: string;
  content: string;
  createdAt: string;
}

export interface ToolCallHistoryMessage {
  type: 'tool_call';
  /** DB id of the assistant message that carried this tool call. */
  id: string;
  toolCallID?: string;
  name: string;
  input: unknown;
  createdAt: string;
}

export interface ToolResultHistoryMessage {
  type: 'tool_result';
  id: string;
  toolCallID?: string;
  toolName: string;
  content: unknown;
  createdAt: string;
}

export type AgentHistoryMessage =
  | UserHistoryMessage
  | AssistantHistoryMessage
  | ToolCallHistoryMessage
  | ToolResultHistoryMessage;

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
 * Flattens raw `graphiteAgentMessages` rows into a typed history. Assistant
 * rows that carry both content and `toolCalls` expand into an assistant entry
 * followed by one `tool_call` entry per invocation.
 */
export function messagesToHistory(
  messages: readonly RawAgentMessage[],
): AgentHistoryMessage[] {
  const history: AgentHistoryMessage[] = [];

  for (const message of messages) {
    const createdAt = message.createdAt;
    const content = message.content ?? '';

    if (message.role === 'user') {
      history.push({ type: 'user', id: message.id, content, createdAt });
      continue;
    }

    if (message.role === 'assistant') {
      if (content) {
        history.push({
          type: 'assistant',
          id: message.id,
          content,
          createdAt,
        });
      }
      if (Array.isArray(message.toolCalls)) {
        for (const call of message.toolCalls) {
          if (!call || typeof call !== 'object') {
            continue;
          }
          const c = call as Record<string, unknown>;
          history.push({
            type: 'tool_call',
            id: message.id,
            toolCallID: asString(c['id']),
            name: asString(c['name']) ?? 'tool',
            input: extractToolInput(c['arguments'] ?? c['input']),
            createdAt,
          });
        }
      }
      continue;
    }

    if (message.role === 'tool') {
      history.push({
        type: 'tool_result',
        id: message.id,
        toolCallID: message.toolCallID ?? undefined,
        toolName: message.toolName ?? 'tool',
        content: message.content,
        createdAt,
      });
    }
  }

  return history;
}
