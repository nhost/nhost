/**
 * AI client for the Nhost JavaScript SDK.
 *
 * Provides a typed interface for interacting with Nhost AI agents — creating
 * sessions and exchanging messages over the agent's SSE stream.
 */

import { type ChainFunction, createEnhancedFetch, FetchError } from '../fetch';
import type { Client as GraphQLClient } from '../graphql';
import { type AgentHistoryMessage, messagesToHistory } from './history';
import {
  type InsertAgentSessionResponse,
  type InsertAgentSessionVariables,
  insertAgentSessionMutation,
} from './mutations';
import {
  type GetAgentSessionResponse,
  type GetAgentSessionVariables,
  getAgentSessionQuery,
} from './queries';
import { AgentSession } from './session';

export type {
  AgentEvent,
  ApprovalRequiredEvent,
  ContentDeltaEvent,
  ErrorEvent,
  StopReasonEvent,
  ToolCallEvent,
  ToolDeniedEvent,
  ToolResultEvent,
  ToolUseStartEvent,
} from './events';
export type {
  AgentHistoryMessage,
  AssistantHistoryMessage,
  ToolCallHistoryMessage,
  ToolResultHistoryMessage,
  UserHistoryMessage,
} from './history';
export type { AgentResponseStream } from './session';
export { AgentSession } from './session';

/** Input for {@link Client.newAgentSession}. */
export interface NewAgentSessionInput {
  /** The agent to create a session for. */
  agentID: string;
}

/** Input for {@link Client.resumeSession}. */
export interface ResumeSessionInput {
  /** The existing session to resume. */
  sessionID: string;
}

/** AI client interface. */
export interface Client {
  /** Base URL for the AI service (e.g. `https://<sub>.ai.<region>.nhost.run/v1`). */
  baseURL: string;

  /**
   * Create a new agent session via GraphQL and return a handle for sending
   * messages to it.
   *
   * `options` is forwarded to the underlying GraphQL request — e.g. pass
   * `{ headers: { 'x-hasura-role': 'user' } }` to impersonate a role for
   * this single call without installing role middleware globally.
   */
  newAgentSession(
    input: NewAgentSessionInput,
    options?: RequestInit,
  ): Promise<AgentSession>;

  /**
   * Resume an existing agent session: fetch its stored messages via GraphQL
   * and return an {@link AgentSession} whose `history` field is populated
   * with the past exchange. The returned session's `sendMessage` continues
   * the same conversation.
   *
   * `options` is forwarded to the GraphQL query — useful for per-call role
   * impersonation or an `AbortSignal`.
   */
  resumeSession(
    input: ResumeSessionInput,
    options?: RequestInit,
  ): Promise<AgentSession>;

  /**
   * Get a handle for an existing session without fetching its history. Use
   * this when you only want to send messages and don't need the past
   * exchange (e.g. fire-and-forget scripts). For a loaded history, use
   * {@link Client.resumeSession}.
   */
  agentSession(sessionID: string, agentID?: string): AgentSession;

  /**
   * Add a middleware function to the AI client's fetch chain. Used internally
   * by {@link withClientSideSessionMiddleware} et al. to attach auth headers.
   */
  pushChainFunction(chainFunction: ChainFunction): void;
}

/**
 * Create an AI API client.
 *
 * `graphqlClient` is required so that `newAgentSession` can issue the
 * `insertGraphiteAgentSession` mutation without duplicating GraphQL plumbing.
 *
 * @param baseURL - Base URL of the AI service, including the `/v1` suffix.
 * @param graphqlClient - The GraphQL client used to insert new sessions.
 * @param chainFunctions - Initial middleware chain for the AI HTTP fetcher.
 */
export const createAPIClient = (
  baseURL: string,
  graphqlClient: GraphQLClient,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let enhancedFetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction): void => {
    chainFunctions.push(chainFunction);
    enhancedFetch = createEnhancedFetch(chainFunctions);
  };

  const newAgentSession = async (
    input: NewAgentSessionInput,
    options?: RequestInit,
  ): Promise<AgentSession> => {
    const response = await graphqlClient.request<
      InsertAgentSessionResponse,
      InsertAgentSessionVariables
    >(
      {
        query: insertAgentSessionMutation,
        variables: { object: { agentID: input.agentID } },
        operationName: 'insertAgentSession',
      },
      options,
    );

    const id = response.body.data?.insertGraphiteAgentSession?.id;
    if (!id) {
      throw new FetchError(response.body, response.status, response.headers);
    }

    return new AgentSession({
      id,
      agentID: input.agentID,
      baseURL,
      enhancedFetch: (url, opts) => enhancedFetch(url, opts),
    });
  };

  const resumeSession = async (
    input: ResumeSessionInput,
    options?: RequestInit,
  ): Promise<AgentSession> => {
    const response = await graphqlClient.request<
      GetAgentSessionResponse,
      GetAgentSessionVariables
    >(
      {
        query: getAgentSessionQuery,
        variables: { sessionID: input.sessionID },
        operationName: 'getAgentSession',
      },
      options,
    );

    const raw = response.body.data?.graphiteAgentSession;
    if (!raw) {
      throw new FetchError(response.body, response.status, response.headers);
    }

    const history: AgentHistoryMessage[] = messagesToHistory(raw.agentMessages);

    return new AgentSession({
      id: raw.id,
      agentID: raw.agentID,
      userID: raw.userID ?? undefined,
      baseURL,
      enhancedFetch: (url, opts) => enhancedFetch(url, opts),
      history,
    });
  };

  const agentSession = (sessionID: string, agentID?: string): AgentSession =>
    new AgentSession({
      id: sessionID,
      agentID,
      baseURL,
      enhancedFetch: (url, options) => enhancedFetch(url, options),
    });

  return {
    baseURL,
    newAgentSession,
    resumeSession,
    agentSession,
    pushChainFunction,
  };
};
