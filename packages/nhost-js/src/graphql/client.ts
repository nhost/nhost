/**
 * GraphQL client for the Nhost JavaScript SDK.
 *
 * This module provides functionality for executing GraphQL operations against
 * a Hasura GraphQL API.
 */

import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import {
  type ChainFunction,
  createEnhancedFetch,
  FetchError,
  type FetchResponse,
} from "../fetch";

/**
 * Variables object for GraphQL operations.
 * Key-value pairs of variable names and their values.
 */
export type GraphQLVariables = Record<string, unknown>;

/**
 * GraphQL request object used for queries and mutations.
 */
export interface GraphQLRequest<TVariables = GraphQLVariables> {
  /** The GraphQL query or mutation string */
  query: string;
  /** Optional variables for parameterized queries */
  variables?: TVariables;
  /** Optional name of the operation to execute */
  operationName?: string;
}

/**
 * Represents a GraphQL error returned from the server.
 */
export interface GraphQLError {
  /** Error message */
  message: string;
  /** Source locations in the GraphQL document where the error occurred */
  locations?: { line: number; column: number }[];
  /** Path in the query where the error occurred */
  path?: string[];
  /** Additional error information specific to the GraphQL implementation */
  extensions?: { path: string; code: string };
}

/**
 * Standard GraphQL response format as defined by the GraphQL specification.
 */
export interface GraphQLResponse<TResponseData = unknown> {
  /** The data returned from successful execution */
  data?: TResponseData;
  /** Array of errors if execution was unsuccessful or partially successful */
  errors?: GraphQLError[];
}

/**
 * GraphQL client interface providing methods for executing queries and mutations
 */
export interface Client {
  /**
   * Execute a GraphQL query operation
   *
   * Queries are used to fetch data and should not modify any data on the server.
   *
   * @param request - GraphQL request object containing query and optional variables
   * @param options - Additional fetch options to apply to the request
   * @returns Promise with the GraphQL response and metadata
   */
  request<TResponseData = unknown, TVariables = GraphQLVariables>(
    request: GraphQLRequest<TVariables>,
    options?: RequestInit,
  ): Promise<FetchResponse<GraphQLResponse<TResponseData>>>;

  /**
   * Execute a GraphQL query operation using a typed document node
   *
   * @param document - TypedDocumentNode containing the query and type information
   * @param variables - Variables for the GraphQL operation
   * @param options - Additional fetch options to apply to the request
   * @returns Promise with the GraphQL response and metadata
   */
  request<TResponseData, TVariables = GraphQLVariables>(
    document: TypedDocumentNode<TResponseData, TVariables>,
    variables?: TVariables,
    options?: RequestInit,
  ): Promise<FetchResponse<GraphQLResponse<TResponseData>>>;

  /**
   * URL for the GraphQL endpoint.
   */
  url: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;
}

/**
 * Creates a GraphQL API client for interacting with a GraphQL endpoint.
 *
 * This client provides methods for executing queries and mutations against
 * a GraphQL API, with support for middleware functions to handle authentication,
 * error handling, and other cross-cutting concerns.
 *
 * @param url - Base URL for the GraphQL endpoint
 * @param chainFunctions - Array of middleware functions for the fetch chain
 * @returns GraphQL client with query and mutation methods
 */
export const createAPIClient = (
  url: string,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let enhancedFetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction);
    enhancedFetch = createEnhancedFetch(chainFunctions);
  };

  const executeOperation = async <
    TResponseData = unknown,
    TVariables = GraphQLVariables,
  >(
    request: GraphQLRequest<TVariables>,
    options?: RequestInit,
  ): Promise<FetchResponse<GraphQLResponse<TResponseData>>> => {
    const response = await enhancedFetch(`${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      ...options,
    });

    const body = await response.text();
    const data: GraphQLResponse<TResponseData> = (
      body ? JSON.parse(body) : {}
    ) as GraphQLResponse<TResponseData>;

    const resp = {
      body: data,
      status: response.status,
      headers: response.headers,
    };

    if (data.errors) {
      throw new FetchError(data, response.status, response.headers);
    }

    return resp;
  };

  function request<TResponseData = unknown, TVariables = GraphQLVariables>(
    request: GraphQLRequest<TVariables>,
    options?: RequestInit,
  ): Promise<FetchResponse<GraphQLResponse<TResponseData>>>;
  function request<TResponseData, TVariables = GraphQLVariables>(
    document: TypedDocumentNode<TResponseData, TVariables>,
    variables?: TVariables,
    options?: RequestInit,
  ): Promise<FetchResponse<GraphQLResponse<TResponseData>>>;
  function request<TResponseData, TVariables = GraphQLVariables>(
    requestOrDocument:
      | GraphQLRequest<TVariables>
      | TypedDocumentNode<TResponseData, TVariables>,
    variablesOrOptions?: TVariables | RequestInit,
    options?: RequestInit,
  ): Promise<FetchResponse<GraphQLResponse<TResponseData>>> {
    if (typeof requestOrDocument === "object" && "kind" in requestOrDocument) {
      const definition = requestOrDocument.definitions[0];

      const request: GraphQLRequest<TVariables> = {
        query: requestOrDocument.loc?.source.body || "",
        variables: variablesOrOptions as TVariables,
        operationName:
          definition && "name" in definition
            ? definition.name?.value
            : undefined,
      };
      return executeOperation(request, options);
    } else {
      // Handle GraphQLRequest
      const request = requestOrDocument;
      const requestOptions = variablesOrOptions as RequestInit;
      return executeOperation(request, requestOptions);
    }
  }

  return {
    request,
    url,
    pushChainFunction,
  } as Client;
};
