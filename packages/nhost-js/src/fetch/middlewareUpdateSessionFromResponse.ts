/**
 * Session response middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically extract
 * and persist session information from authentication responses, ensuring
 * that new sessions are properly stored after sign-in operations.
 */

import type { Session, SessionPayload } from "../auth";
import type { SessionStorage } from "../session/storage";
import type { ChainFunction } from "./fetch";

/**
 * Creates a fetch middleware that automatically extracts and stores session data from API responses.
 *
 * This middleware:
 * 1. Monitors responses from authentication-related endpoints
 * 2. Extracts session information when present
 * 3. Stores the session in the provided storage implementation
 * 4. Handles session removal on sign-out
 *
 * This ensures that session data is always up-to-date in storage after operations
 * that create or invalidate sessions.
 *
 * @param storage - Storage implementation for persisting session data
 * @returns A middleware function that can be used in the fetch chain
 */
export const updateSessionFromResponseMiddleware = (
  storage: SessionStorage,
): ChainFunction => {
  /**
   * Helper function to extract session data from various response formats
   *
   * @param body - Response data to extract session from
   * @returns Session object if found, null otherwise
   */
  const sessionExtractor = function (
    body: Session | SessionPayload | string,
  ): Session | null {
    if (typeof body === "string") {
      return null;
    }

    if ("session" in body) {
      // SessionPayload
      return body.session || null;
    }

    if ("accessToken" in body && "refreshToken" in body) {
      // Session
      return body;
    }

    return null;
  };

  return (next: (url: string, options?: RequestInit) => Promise<Response>) =>
    async (url: string, options?: RequestInit) => {
      // Call the next middleware in the chain
      const response = await next(url, options);

      try {
        // Check if this is a logout request
        if (url.endsWith("/signout")) {
          // Remove session on sign-out
          storage.remove();
          return response;
        }

        // Check if this is an auth-related endpoint that might return session data
        if (
          url.endsWith("/token") ||
          url.includes("/signin/") ||
          url.includes("/signup/")
        ) {
          // Clone the response to avoid consuming it
          const clonedResponse = response.clone();

          // Parse the JSON data
          const body = (await clonedResponse.json().catch(() => null)) as
            | Session
            | SessionPayload;

          if (body) {
            // Extract session data from response using provided extractor
            const session = sessionExtractor(body);

            // If session data is found, store it
            if (session && session.accessToken && session.refreshToken) {
              storage.set(session);
            }
          }
        }
      } catch (error) {
        console.warn("Error in session response middleware:", error);
      }

      // Return the original response
      return response;
    };
};
