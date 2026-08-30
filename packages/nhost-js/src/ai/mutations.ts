/** GraphQL mutation used to create an AI agent session. */
export const insertAgentSessionMutation = `
mutation insertAgentSession($object: aiAgentSessions_insert_input!) {
  insertAiAgentSession(object: $object) {
    id
  }
}
`;

export interface InsertAgentSessionVariables {
  object: {
    agentID: string;
  };
}

export interface InsertAgentSessionResponse {
  insertAiAgentSession: {
    id: string;
  } | null;
}
