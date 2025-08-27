/**
 * Auth token refresh middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically refresh
 * authentication tokens before they expire, ensuring seamless API access
 * without requiring manual token refresh by the application.
 */

import type { Client } from '../auth'
import type { ChainFunction, FetchFunction } from './fetch'
import type { SessionStorage } from '../session/storage'
import { refreshSession } from '../session/refreshSession'

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
    marginSeconds?: number
  }
): ChainFunction => {
  const { marginSeconds = 60 } = options || {}

  // Create and return the chain function
  return (next: FetchFunction): FetchFunction =>
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Skip token handling for certain requests
      if (shouldSkipTokenHandling(url, options)) {
        return next(url, options)
      }

      try {
        await refreshSession(auth, storage, marginSeconds)
      } catch {
        // do nothing, we still want to call the next function
      }
      return next(url, options)
    }
}

/**
 * Determines if token handling should be skipped for this request
 *
 * @param url - Request URL
 * @param options - Request options
 * @returns True if token handling should be skipped, false otherwise
 */
function shouldSkipTokenHandling(url: string, options: RequestInit): boolean {
  const headers = new Headers(options.headers || {})

  // If Authorization header is explicitly set, skip token handling
  if (headers.has('Authorization')) {
    return true
  }

  // If calling the token endpoint, skip to avoid infinite loops
  if (url.endsWith('/v1/token')) {
    return true
  }

  return false
}
