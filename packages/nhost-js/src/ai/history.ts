import { asString, extractToolInput } from './events';
import type { RawAgentMessage } from './queries';

/** A user message already persisted in an agent session. */
export interface UserHistoryMessage {
  type: 'user';
  id: string;
  content: string;
  createdAt: string;
}

/** Assistant text already persisted in an agent session. */
export interface AssistantHistoryMessage {
  type: 'assistant';
  id: string;
  content: string;
  createdAt: string;
}

/** A tool call stored on a persisted assistant message. */
export interface ToolCallHistoryMessage {
  type: 'tool_call';
  /** Database id of the assistant message that carried this tool call. */
  id: string;
  toolCallID?: string;
  name: string;
  input: unknown;
  createdAt: string;
}

/** A persisted tool result. */
export interface ToolResultHistoryMessage {
  type: 'tool_result';
  id: string;
  toolCallID?: string;
  toolName: string;
  content: string;
  createdAt: string;
}

export type AgentHistoryMessage =
  | UserHistoryMessage
  | AssistantHistoryMessage
  | ToolCallHistoryMessage
  | ToolResultHistoryMessage;

/**
 * Flattens `aiAgentMessages` rows into a typed history. Assistant rows that
 * contain text and tool calls expand into one assistant entry followed by one
 * `tool_call` entry per invocation.
 */
export function messagesToHistory(
  messages: readonly RawAgentMessage[],
): AgentHistoryMessage[] {
  const history: AgentHistoryMessage[] = [];

  for (const message of messages) {
    const { createdAt, id } = message;

    if (message.role === 'user') {
      history.push({
        type: 'user',
        id,
        content: message.content,
        createdAt,
      });
      continue;
    }

    if (message.role === 'assistant') {
      if (message.content) {
        history.push({
          type: 'assistant',
          id,
          content: message.content,
          createdAt,
        });
      }

      if (Array.isArray(message.toolCalls)) {
        for (const call of message.toolCalls) {
          if (!call || typeof call !== 'object') {
            continue;
          }

          const typedCall = call as Record<string, unknown>;
          history.push({
            type: 'tool_call',
            id,
            toolCallID: asString(typedCall['id']),
            name: asString(typedCall['name']) ?? 'unknown',
            input: extractToolInput(typedCall['arguments']),
            createdAt,
          });
        }
      }
      continue;
    }

    if (message.role === 'tool') {
      history.push({
        type: 'tool_result',
        id,
        toolCallID: message.toolCallID ?? undefined,
        toolName: message.toolName ?? 'unknown',
        content: message.content,
        createdAt,
      });
    }
  }

  return history;
}
