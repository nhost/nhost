/** GraphQL query used to resume an AI agent session. */
export const getAgentSessionQuery = `
query getAgentSession($sessionID: uuid!) {
  aiAgentSession(id: $sessionID) {
    id
    agentID
    userID
    agentMessages(order_by: { createdAt: asc, seq: asc }) {
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

/** One row from the `aiAgentMessages` table, as returned by Hasura. */
export interface RawAgentMessage {
  id: string;
  role: string;
  content: string;
  toolCalls: unknown;
  toolCallID: string | null;
  toolName: string | null;
  createdAt: string;
}

export interface GetAgentSessionResponse {
  aiAgentSession: {
    id: string;
    agentID: string;
    userID: string | null;
    agentMessages: RawAgentMessage[];
  } | null;
}
