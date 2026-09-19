/**
 * Auth token refresh middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically refresh
 * authentication tokens before they expire, ensuring seamless API access
 * without requiring manual token refresh by the application.
 */

import type { Client } from '../auth';
import { refreshSession } from '../session/refreshSession';
import type { SessionStorage } from '../session/storage';
import type { ChainFunction, FetchFunction } from './fetch';
import { requestScopeFromBaseUrl } from './requestScope';

/**
 * Creates a fetch middleware that automatically refreshes authentication tokens.
 *
 * This middleware:
 * 1. Checks if the current token is about to expire
 * 2. If so, uses the refresh token to obtain a new access token
 *
 * The middleware handles token refresh transparently, so the application
 * doesn't need to manually refresh tokens.
 *
 * @param auth - Auth API client for token refresh operations
 * @param storage - Storage implementation for persisting session data
 * @param options - Configuration options for token refresh behavior
 * @param options.marginSeconds - Number of seconds before token expiration to trigger a refresh, default is 60 seconds
 * @returns A middleware function that can be used in the fetch chain
 */
export const sessionRefreshMiddleware = (
  auth: Client,
  storage: SessionStorage,
  options?: {
    marginSeconds?: number;
  },
): ChainFunction => {
  const { marginSeconds = 60 } = options || {};

  // Resolve the auth origin and its exact token endpoint once. Matching the
  // complete endpoint rather than a path suffix matters because this middleware
  // also runs for storage, GraphQL and Functions, whose valid request paths may
  // end in `/token` too, and because a custom auth URL need not use `/v1`.
  const authScope = requestScopeFromBaseUrl(auth.baseURL);
  const tokenPath = `${authScope.pathPrefix}/token`;

  // Create and return the chain function
  return (next: FetchFunction): FetchFunction =>
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Skip token handling for certain requests
      if (shouldSkipTokenHandling(url, options, authScope, tokenPath)) {
        return next(url, options);
      }

      try {
        await refreshSession(auth, storage, marginSeconds);
      } catch {
        // do nothing, we still want to call the next function
      }
      return next(url, options);
    };
};

/**
 * Determines if token handling should be skipped for this request
 *
 * @param url - Request URL
 * @param options - Request options
 * @param authScope - Origin scope of the auth service
 * @param tokenPath - Exact path of the auth token endpoint
 * @returns True if token handling should be skipped, false otherwise
 */
function shouldSkipTokenHandling(
  url: string,
  options: RequestInit,
  authScope: ReturnType<typeof requestScopeFromBaseUrl>,
  tokenPath: string,
): boolean {
  const headers = new Headers(options.headers || {});

  // If Authorization header is explicitly set, skip token handling
  if (headers.has('Authorization')) {
    return true;
  }

  // If calling this auth client's own token endpoint, skip to avoid infinite
  // loops. Another service's `/token` path is a different endpoint and must
  // still trigger a refresh.
  if (!authScope.contains(url)) {
    return false;
  }

  try {
    return new URL(url).pathname.replace(/\/+$/, '') === tokenPath;
  } catch {
    return false;
  }
}
