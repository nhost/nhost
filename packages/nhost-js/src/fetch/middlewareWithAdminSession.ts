/**
 * Admin session middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically attach
 * Hasura admin secret for admin permissions in requests.
 */

import type { ChainFunction, FetchFunction } from './fetch';

/**
 * Configuration options for admin session middleware
 */
export interface AdminSessionOptions {
  /**
   * Hasura admin secret for elevated permissions (sets x-hasura-admin-secret header)
   */
  adminSecret: string;

  /**
   * Hasura role to use for the request (sets x-hasura-role header)
   */
  role?: string;

  /**
   * Additional Hasura session variables to attach to requests.
   * Keys will be automatically prefixed with 'x-hasura-' if not already present.
   *
   * @example
   * ```ts
   * {
   *   'user-id': '123',
   *   'org-id': '456'
   * }
   * // Results in headers:
   * // x-hasura-user-id: 123
   * // x-hasura-org-id: 456
   * ```
   */
  sessionVariables?: Record<string, string>;
}

/**
 * Creates a fetch middleware that attaches the Hasura admin secret and optional session variables to requests.
 *
 * This middleware:
 * 1. Sets the x-hasura-admin-secret header, which grants full admin access to Hasura
 * 2. Optionally sets the x-hasura-role header if a role is provided
 * 3. Optionally sets additional x-hasura-* headers for custom session variables
 *
 * **Security Warning**: Never use this middleware in client-side code or expose
 * the admin secret to end users. Admin secrets grant unrestricted access to your
 * entire database. This should only be used in trusted server-side environments.
 *
 * The middleware preserves request-specific headers when they conflict with the
 * admin session configuration.
 *
 * @param options - Admin session options including admin secret, role, and session variables
 * @returns A middleware function that can be used in the fetch chain
 *
 * @example
 * ```ts
 * // Create middleware with admin secret only
 * const adminMiddleware = withAdminSessionMiddleware({
 *   adminSecret: process.env.NHOST_ADMIN_SECRET
 * });
 *
 * // Create middleware with admin secret and role
 * const adminUserMiddleware = withAdminSessionMiddleware({
 *   adminSecret: process.env.NHOST_ADMIN_SECRET,
 *   role: 'user'
 * });
 *
 * // Create middleware with admin secret, role, and custom session variables
 * const fullMiddleware = withAdminSessionMiddleware({
 *   adminSecret: process.env.NHOST_ADMIN_SECRET,
 *   role: 'user',
 *   sessionVariables: {
 *     'user-id': '123',
 *     'org-id': '456'
 *   }
 * });
 *
 * // Use with createCustomClient for an admin client
 * const adminClient = createCustomClient({
 *   subdomain: 'myproject',
 *   region: 'eu-central-1',
 *   chainFunctions: [adminMiddleware]
 * });
 * ```
 */
export const withAdminSessionMiddleware =
  (options: AdminSessionOptions): ChainFunction =>
  (next: FetchFunction): FetchFunction =>
  async (url: string, requestOptions: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(requestOptions.headers || {});

    // Set x-hasura-admin-secret if not already present
    if (!headers.has('x-hasura-admin-secret')) {
      headers.set('x-hasura-admin-secret', options.adminSecret);
    }

    // Set x-hasura-role if provided and not already present
    if (options.role && !headers.has('x-hasura-role')) {
      headers.set('x-hasura-role', options.role);
    }

    // Set custom session variables
    if (options.sessionVariables) {
      for (const [key, value] of Object.entries(options.sessionVariables)) {
        // Ensure the key has the x-hasura- prefix
        const headerKey = key.startsWith('x-hasura-') ? key : `x-hasura-${key}`;

        // Only set if not already present in the request
        if (!headers.has(headerKey)) {
          headers.set(headerKey, value);
        }
      }
    }

    return next(url, { ...requestOptions, headers });
  };
