/**
 * Role middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically set
 * the Hasura role for all requests. This is useful when you want to
 * make requests as a specific role without using the admin secret.
 */

import type { ChainFunction, FetchFunction } from './fetch';

/**
 * Creates a fetch middleware that sets the Hasura role header.
 *
 * This middleware sets the x-hasura-role header for all requests, allowing
 * you to specify which role's permissions should be used. This works with
 * authenticated sessions where the user has access to the specified role.
 *
 * Unlike `withAdminSessionMiddleware`, this does not bypass permission rules
 * but instead uses the permission rules defined for the specified role.
 *
 * The middleware preserves request-specific headers when they conflict with
 * the role configuration.
 *
 * @param role - The Hasura role to use for requests
 * @returns A middleware function that can be used in the fetch chain
 *
 * @example
 * ```ts
 * // Use with createClient to default all requests to a specific role
 * const nhost = createClient({
 *   subdomain: 'myproject',
 *   region: 'eu-central-1',
 *   chainFunctions: [withRoleMiddleware('moderator')]
 * });
 *
 * // Use with createServerClient for server-side requests
 * const serverNhost = createServerClient({
 *   subdomain: 'myproject',
 *   region: 'eu-central-1',
 *   storage: myServerStorage,
 *   chainFunctions: [withRoleMiddleware('moderator')]
 * });
 * ```
 */
export const withRoleMiddleware =
  (role: string): ChainFunction =>
  (next: FetchFunction): FetchFunction =>
  async (url: string, requestOptions: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(requestOptions.headers || {});

    // Set x-hasura-role if not already present
    if (!headers.has('x-hasura-role')) {
      headers.set('x-hasura-role', role);
    }

    return next(url, { ...requestOptions, headers });
  };
