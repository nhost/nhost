/**
 * Authorization token attachment middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically attach
 * authorization tokens to outgoing API requests, ensuring the client
 * is properly authenticated.
 */

import type { SessionStorage } from '../session/storage';
import type { ChainFunction, FetchFunction } from './fetch';
import { requestScopeFromBaseUrl } from './requestScope';

/**
 * Creates a fetch middleware that adds the Authorization header with the current access token.
 *
 * The token is written only for requests inside `serviceUrl`'s origin. A request
 * that has left that origin has the stored bearer token stripped, so custom
 * middleware that retargets a request cannot forward the user's access token to
 * another host. An unrelated caller-supplied `Authorization` value is always
 * preserved.
 *
 * This middleware should be used after the refresh middleware in the chain to
 * ensure the most recent token is used.
 *
 * @param storage - Storage implementation for retrieving session data
 * @param serviceUrl - Base URL of the service this middleware is installed on
 * @returns A middleware function that adds Authorization headers
 */
export const attachAccessTokenMiddleware =
  (storage: SessionStorage, serviceUrl: string): ChainFunction =>
  (next: FetchFunction): FetchFunction =>
  async (url: string, options: RequestInit = {}): Promise<Response> => {
    const scope = requestScopeFromBaseUrl(serviceUrl);
    const inScope = scope.contains(url);
    const headers = new Headers(options.headers || {});
    const hasAuthorization = headers.has('Authorization');

    // In scope with a caller-supplied header: the caller wins.
    // Out of scope with no header: nothing to do.
    if (inScope === hasAuthorization) {
      return next(url, options);
    }

    const session = storage.get();
    if (!session?.accessToken) {
      return next(url, options);
    }

    const authorization = `Bearer ${session.accessToken}`;
    if (inScope) {
      headers.set('Authorization', authorization);
    } else if (headers.get('Authorization') === authorization) {
      // Off-origin and carrying exactly the stored token: strip it. An
      // unrelated caller-supplied value is left untouched.
      headers.delete('Authorization');
    } else {
      return next(url, options);
    }

    return next(url, { ...options, headers });
  };
