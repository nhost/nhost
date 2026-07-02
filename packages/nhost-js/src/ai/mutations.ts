/**
 * GraphQL mutations used by the AI client.
 *
 * Co-located here instead of pulling in codegen because there is exactly one
 * mutation needed and the response shape is trivial.
 */

export const insertAgentSessionMutation = `
mutation insertAgentSession($object: graphiteAgentSessions_insert_input!) {
  insertGraphiteAgentSession(object: $object) {
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
  insertGraphiteAgentSession: {
    id: string;
  } | null;
}
