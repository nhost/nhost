/**
 * GraphQL queries used by the AI client.
 *
 * Co-located so the SDK can issue them via the shared GraphQL client without
 * a separate codegen step.
 */

export const getAgentSessionQuery = `
query getAgentSession($sessionID: uuid!) {
  graphiteAgentSession(id: $sessionID) {
    id
    agentID
    userID
    agentMessages(order_by: { createdAt: asc }) {
      id
      role
      content
      toolCalls
      toolCallID
      toolName
      createdAt
    }
  }
}
`;

export interface GetAgentSessionVariables {
  sessionID: string;
}

/** One row from the `graphiteAgentMessages` table, as returned by Hasura. */
export interface RawAgentMessage {
  id: string;
  role: string;
  content: string | null;
  toolCalls: unknown;
  toolCallID: string | null;
  toolName: string | null;
  createdAt: string;
}

export interface GetAgentSessionResponse {
  graphiteAgentSession: {
    id: string;
    agentID: string;
    userID: string | null;
    agentMessages: RawAgentMessage[];
  } | null;
}
