import { generateServiceUrl } from "./";
import {
  type Client as AuthClient,
  createAPIClient as createAuthClient,
} from "./auth";
import {
  attachAccessTokenMiddleware,
  type ChainFunction,
  sessionRefreshMiddleware,
  updateSessionFromResponseMiddleware,
} from "./fetch";
import {
  createAPIClient as createFunctionsClient,
  type Client as FunctionsClient,
} from "./functions";
import {
  createAPIClient as createGraphQLClient,
  type Client as GraphQLClient,
} from "./graphql";
import {
  detectStorage,
  refreshSession,
  type Session,
  SessionStorage,
  type SessionStorageBackend,
} from "./session/";
import {
  createAPIClient as createStorageClient,
  type Client as StorageClient,
} from "./storage";

/**
 * Main client class that provides unified access to all Nhost services.
 * This class serves as the central interface for interacting with Nhost's
 * authentication, storage, GraphQL, and serverless functions capabilities.
 */
export class NhostClient {
  /**
   * Authentication client providing methods for user sign-in, sign-up, and session management.
   * Use this client to handle all authentication-related operations.
   */
  auth: AuthClient;

  /**
   * Storage client providing methods for file operations (upload, download, delete).
   * Use this client to manage files in your Nhost storage.
   */
  storage: StorageClient;

  /**
   * GraphQL client providing methods for executing GraphQL operations against your Hasura backend.
   * Use this client to query and mutate data in your database through GraphQL.
   */
  graphql: GraphQLClient;

  /**
   * Functions client providing methods for invoking serverless functions.
   * Use this client to call your custom serverless functions deployed to Nhost.
   */
  functions: FunctionsClient;

  /**
   * Storage implementation used for persisting session information.
   * This handles saving, retrieving, and managing authentication sessions across requests.
   */
  sessionStorage: SessionStorage;

  /**
   * Create a new Nhost client. This constructor is reserved for advanced use cases.
   * For typical usage, use [createClient](#createclient) or [createServerClient](#createserverclient) instead.
   *
   * @param auth - Authentication client instance
   * @param storage - Storage client instance
   * @param graphql - GraphQL client instance
   * @param functions - Functions client instance
   * @param sessionStorage - Storage implementation for session persistence
   */
  constructor(
    auth: AuthClient,
    storage: StorageClient,
    graphql: GraphQLClient,
    functions: FunctionsClient,
    sessionStorage: SessionStorage,
  ) {
    this.auth = auth;
    this.storage = storage;
    this.graphql = graphql;
    this.functions = functions;
    this.sessionStorage = sessionStorage;
  }

  /**
   * Get the current session from storage.
   * This method retrieves the authenticated user's session information if one exists.
   *
   * @returns The current session or null if no session exists
   *
   * @example
   * ```ts
   * const session = nhost.getUserSession();
   * if (session) {
   *   console.log('User is authenticated:', session.user.id);
   * } else {
   *   console.log('No active session');
   * }
   * ```
   */
  getUserSession(): Session | null {
    return this.sessionStorage.get();
  }

  /**
   * Refresh the session using the current refresh token
   * in the storage and update the storage with the new session.
   *
   * This method can be used to proactively refresh tokens before they expire
   * or to force a refresh when needed.
   *
   * @param marginSeconds - The number of seconds before the token expiration to refresh the session. If the token is still valid for this duration, it will not be refreshed. Set to 0 to force the refresh.
   *
   * @returns The new session or null if there is currently no session or if refresh fails
   *
   * @example
   * ```ts
   * // Refresh token if it's about to expire in the next 5 minutes
   * const refreshedSession = await nhost.refreshSession(300);
   *
   * // Force refresh regardless of current token expiration
   * const forcedRefresh = await nhost.refreshSession(0);
   * ```
   */
  async refreshSession(marginSeconds = 60): Promise<Session | null> {
    return refreshSession(this.auth, this.sessionStorage, marginSeconds);
  }

  /**
   * Clear the session from storage.
   *
   * This method removes the current authentication session, effectively logging out the user.
   * Note that this is a client-side operation and doesn't invalidate the refresh token on
   * the server, which can be done with `nhost.auth.signOut({refreshToken: session.refreshTokenId})`.
   * If the middle `updateSessionFromResponseMiddleware` is used, the session will be removed
   * from the storage automatically and calling this method is not necessary.
   *
   * @example
   * ```ts
   * // Log out the user
   * nhost.clearSession();
   * ```
   */
  clearSession(): void {
    this.sessionStorage.remove();
  }
}

/**
 * Configuration options for creating an Nhost client
 */
export interface NhostClientOptions {
  /**
   * Nhost project subdomain (e.g., 'abcdefgh'). Used to construct the base URL for services for the Nhost cloud.
   */
  subdomain?: string;

  /**
   * Nhost region (e.g., 'eu-central-1'). Used to construct the base URL for services for the Nhost cloud.
   */
  region?: string;

  /**
   * Complete base URL for the auth service (overrides subdomain/region)
   */
  authUrl?: string;

  /**
   * Complete base URL for the storage service (overrides subdomain/region)
   */
  storageUrl?: string;

  /**
   * Complete base URL for the GraphQL service (overrides subdomain/region)
   */
  graphqlUrl?: string;

  /**
   * Complete base URL for the functions service (overrides subdomain/region)
   */
  functionsUrl?: string;

  /**
   * Storage backend to use for session persistence. If not provided, the SDK will
   * default to localStorage in the browser or memory in other environments.
   */
  storage?: SessionStorageBackend;
}

/**
 * Creates and configures a new Nhost client instance optimized for client-side usage.
 *
 * This helper method instantiates a fully configured Nhost client by:
 * - Instantiating the various service clients (auth, storage, functions and graphql)
 * - Auto-detecting and configuring an appropriate session storage (localStorage in browsers, memory otherwise)
 * - Setting up a sophisticated middleware chain for seamless authentication management:
 *   - Automatically refreshing tokens before they expire
 *   - Attaching authorization tokens to all service requests
 *   - Updating the session storage when new tokens are received
 *
 * This method includes automatic session refresh middleware, making it ideal for
 * client-side applications where long-lived sessions are expected.
 *
 * @param options - Configuration options for the client
 * @returns A configured Nhost client
 *
 * @example
 * ```ts
 * // Create client using Nhost cloud default URLs
 * const nhost = createClient({
 *   subdomain: 'abcdefgh',
 *   region: 'eu-central-1'
 * });
 *
 * // Create client with custom service URLs
 * const customNhost = createClient({
 *   authUrl: 'https://auth.example.com',
 *   storageUrl: 'https://storage.example.com',
 *   graphqlUrl: 'https://graphql.example.com',
 *   functionsUrl: 'https://functions.example.com'
 * });
 *
 * // Create client using cookies for storing the session
 * import { CookieStorage } from "@nhost/nhost-js/session";
 *
 * const nhost = createClient({
 *   subdomain: 'abcdefgh',
 *   region: 'eu-central-1',
 *   storage: new CookieStorage({
 *      secure: import.meta.env.ENVIRONMENT === 'production',
 *   })
 * });
 * ```
 */
export function createClient(options: NhostClientOptions = {}): NhostClient {
  const {
    subdomain,
    region,
    authUrl,
    storageUrl,
    graphqlUrl,
    functionsUrl,
    storage = detectStorage(),
  } = options;

  const sessionStorage = new SessionStorage(storage);

  // Determine base URLs for each service
  const authBaseUrl = generateServiceUrl("auth", subdomain, region, authUrl);
  const storageBaseUrl = generateServiceUrl(
    "storage",
    subdomain,
    region,
    storageUrl,
  );
  const graphqlBaseUrl = generateServiceUrl(
    "graphql",
    subdomain,
    region,
    graphqlUrl,
  );

  const functionsBaseUrl = generateServiceUrl(
    "functions",
    subdomain,
    region,
    functionsUrl,
  );

  // Create auth client
  const auth = createAuthClient(authBaseUrl);

  const mwChain = getMiddlewareChain(auth, sessionStorage, true);

  for (const mw of mwChain) {
    auth.pushChainFunction(mw);
  }

  // Create storage and graphql clients with the refresh and attach token middlewares
  const storageClient = createStorageClient(storageBaseUrl, mwChain);
  const graphqlClient = createGraphQLClient(graphqlBaseUrl, mwChain);
  const functionsClient = createFunctionsClient(functionsBaseUrl, mwChain);

  // Return an initialized NhostClient
  return new NhostClient(
    auth,
    storageClient,
    graphqlClient,
    functionsClient,
    sessionStorage,
  );
}

export interface NhostServerClientOptions extends NhostClientOptions {
  /**
   * Storage backend to use for session persistence in server environments.
   * Unlike the base options, this field is required for server-side usage
   * as the SDK cannot auto-detect an appropriate storage mechanism.
   */
  storage: SessionStorageBackend;
}

/**
 * Creates and configures a new Nhost client instance optimized for server-side usage.
 *
 * This helper method instantiates a fully configured Nhost client specifically designed for:
 * - Server components (in frameworks like Next.js or Remix)
 * - API routes and middleware
 * - Backend services and server-side rendering contexts
 *
 * Key differences from the standard client:
 * - Requires explicit storage implementation (must be provided)
 * - Disables automatic session refresh middleware (to prevent race conditions in server contexts)
 * - Still attaches authorization tokens and updates session storage from responses
 *
 * The server client is ideal for short-lived request contexts where session tokens
 * are passed in (like cookie-based authentication flows) and automatic refresh
 * mechanisms could cause issues with concurrent requests.
 *
 * @param options - Configuration options for the server client (requires storage implementation)
 * @returns A configured Nhost client optimized for server-side usage
 *
 * @example
 * ```ts
 * // Example with cookie storage for Next.js API route or server component
 * import { cookies } from 'next/headers';
 *
 * const nhost = createServerClient({
 *   region: process.env["NHOST_REGION"] || "local",
 *   subdomain: process.env["NHOST_SUBDOMAIN"] || "local",
 *   storage: {
 *     // storage compatible with Next.js server components
 *     get: (): Session | null => {
 *       const s = cookieStore.get(key)?.value || null;
 *       if (!s) {
 *         return null;
 *       }
 *       const session = JSON.parse(s) as Session;
 *       return session;
 *     },
 *     set: (value: Session) => {
 *       cookieStore.set(key, JSON.stringify(value));
 *     },
 *     remove: () => {
 *       cookieStore.delete(key);
 *     },
 *   },
 * });
 *
 * // Example with cookie storage for Next.js middleware
 * const nhost = createServerClient({
 *   region: process.env["NHOST_REGION"] || "local",
 *   subdomain: process.env["NHOST_SUBDOMAIN"] || "local",
 *   storage: {
 *     // storage compatible with Next.js middleware
 *     get: (): Session | null => {
 *       const raw = request.cookies.get(key)?.value || null;
 *       if (!raw) {
 *         return null;
 *       }
 *       const session = JSON.parse(raw) as Session;
 *       return session;
 *     },
 *     set: (value: Session) => {
 *       response.cookies.set({
 *         name: key,
 *         value: JSON.stringify(value),
 *         path: "/",
 *         httpOnly: false, //if set to true we can't access it in the client
 *         secure: process.env.NODE_ENV === "production",
 *         sameSite: "lax",
 *         maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
 *       });
 *     },
 *     remove: () => {
 *       response.cookies.delete(key);
 *     },
 *   },
 * });
 *
 * // Example for express reading session from a cookie
 *
 * import express, { Request, Response } from "express";
 * import cookieParser from "cookie-parser";
 *
 * app.use(cookieParser());
 *
 * const nhostClientFromCookies = (req: Request) => {
 *   return createServerClient({
 *     subdomain: "local",
 *     region: "local",
 *     storage: {
 *       get: (): Session | null => {
 *         const s = req.cookies.nhostSession || null;
 *         if (!s) {
 *           return null;
 *         }
 *         const session = JSON.parse(s) as Session;
 *         return session;
 *       },
 *       set: (_value: Session) => {
 *         throw new Error("It is easier to handle the session in the client");
 *       },
 *       remove: () => {
 *         throw new Error("It is easier to handle the session in the client");
 *       },
 *     },
 *   });
 * };
 * ```
 */
export function createServerClient(
  options: NhostServerClientOptions,
): NhostClient {
  const {
    subdomain,
    region,
    authUrl,
    storageUrl,
    graphqlUrl,
    functionsUrl,
    storage,
  } = options;
  const sessionStorage = new SessionStorage(storage);

  // Determine base URLs for each service
  const authBaseUrl = generateServiceUrl("auth", subdomain, region, authUrl);
  const storageBaseUrl = generateServiceUrl(
    "storage",
    subdomain,
    region,
    storageUrl,
  );
  const graphqlBaseUrl = generateServiceUrl(
    "graphql",
    subdomain,
    region,
    graphqlUrl,
  );

  const functionsBaseUrl = generateServiceUrl(
    "functions",
    subdomain,
    region,
    functionsUrl,
  );

  // Create auth client
  const auth = createAuthClient(authBaseUrl);

  const mwChain = getMiddlewareChain(auth, sessionStorage, false);

  for (const mw of mwChain) {
    auth.pushChainFunction(mw);
  }

  // Create storage and graphql clients with the refresh and attach token middlewares
  const storageClient = createStorageClient(storageBaseUrl, mwChain);
  const graphqlClient = createGraphQLClient(graphqlBaseUrl, mwChain);
  const functionsClient = createFunctionsClient(functionsBaseUrl, mwChain);

  // Return an initialized NhostClient
  return new NhostClient(
    auth,
    storageClient,
    graphqlClient,
    functionsClient,
    sessionStorage,
  );
}

function getMiddlewareChain(
  auth: AuthClient,
  storage: SessionStorage,
  autoRefresh: boolean,
): ChainFunction[] {
  const mwChain = [
    updateSessionFromResponseMiddleware(storage),
    attachAccessTokenMiddleware(storage),
  ];

  if (autoRefresh) {
    mwChain.unshift(sessionRefreshMiddleware(auth, storage));
  }

  return mwChain;
}
