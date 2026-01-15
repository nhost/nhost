/**
 * Enhanced fetch implementation with middleware support.
 *
 * This module provides a middleware pattern for the Fetch API, allowing
 * chain functions to be applied to requests and responses, such as
 * authentication token refreshing, error handling, and request/response transformation.
 *
 * This is an advanced submodule of the Nhost SDK, primarily used internally but it is exposed
 * for advanced use cases.
 *
 * @module fetch
 * @packageDocumentation
 */

export {
  type ChainFunction,
  createEnhancedFetch,
  FetchError,
  type FetchFunction,
  type FetchResponse,
} from './fetch';

/**
 * Middleware for attaching authorization tokens to outgoing requests.
 *
 * @param storage - Storage implementation for retrieving session data
 * @returns A middleware function that adds Authorization headers
 */
export { attachAccessTokenMiddleware } from './middlewareAttachAccessToken';

/**
 * Middleware for automatically refreshing authentication tokens when they're about to expire.
 *
 * @param auth - Auth API client for token refresh operations
 * @param storage - Storage implementation for persisting session data
 * @param options - Configuration options for token refresh behavior
 * @returns A middleware function that refreshes tokens as needed
 */
export { sessionRefreshMiddleware } from './middlewareSessionRefresh';

/**
 * Middleware for extracting and storing session data from authentication responses.
 *
 * @param storage - Storage implementation for persisting session data
 * @returns A middleware function that updates session storage
 */
export { updateSessionFromResponseMiddleware } from './middlewareUpdateSessionFromResponse';
/**
 * Middleware for attaching Hasura admin secret for elevated permissions.
 *
 * @param options - Admin session options including the admin secret
 * @returns A middleware function that adds x-hasura-admin-secret header
 */
export {
  type AdminSessionOptions,
  withAdminSessionMiddleware,
} from './middlewareWithAdminSession';
export { withHeadersMiddleware } from './middlewareWithHeaders';

/**
 * Middleware for setting the Hasura role header for requests.
 *
 * @param role - The Hasura role to use for requests
 * @returns A middleware function that adds x-hasura-role header
 */
export { withRoleMiddleware } from './middlewareWithRole';
