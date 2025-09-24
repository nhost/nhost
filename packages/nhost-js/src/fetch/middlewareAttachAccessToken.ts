/**
 * Authorization token attachment middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically attach
 * authorization tokens to outgoing API requests, ensuring the client
 * is properly authenticated.
 */

import type { Session } from "../auth";
import type { SessionStorage } from "../session/storage";
import type { ChainFunction, FetchFunction } from "./fetch";

/**
 * Creates a fetch middleware that adds the Authorization header with the current access token.
 *
 * This middleware:
 * 1. Gets the current session from storage
 * 2. Adds the authorization header with the access token to outgoing requests
 *
 * This middleware should be used after the refresh middleware in the chain to
 * ensure the most recent token is used.
 *
 * @param storage - Storage implementation for retrieving session data
 * @returns A middleware function that adds Authorization headers
 */
export const attachAccessTokenMiddleware =
  (storage: SessionStorage): ChainFunction =>
  (next: FetchFunction): FetchFunction =>
  async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});

    // Skip if Authorization header is already set
    if (headers.has("Authorization")) {
      return next(url, options);
    }

    // Get current session from storage
    const session = storage.get();

    if (session?.accessToken) {
      // Add authorization header
      const newOptions = {
        ...options,
        headers: addAuthorizationHeader(headers, session),
      };

      // Continue with the fetch chain
      return next(url, newOptions);
    }

    // No session or no access token, continue without authorization
    return next(url, options);
  };

/**
 * Adds the Authorization header with the access token to the request headers
 *
 * @param headers - Original request headers
 * @param session - Current session containing the access token
 * @returns Modified headers with Authorization header
 */
function addAuthorizationHeader(headers: Headers, session: Session): Headers {
  if (session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  return headers;
}
