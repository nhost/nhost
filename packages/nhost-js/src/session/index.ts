/**
 * Session management module for Nhost authentication
 *
 * This module exports utilities for managing authentication sessions across
 * different environments and storage backends. It provides:
 *
 * - Session storage abstractions for different environments
 * - Session persistence and synchronization
 * - Automatic token refresh mechanisms
 *
 * This is an advanced submodule of the Nhost SDK, primarily used internally but it is exposed
 * for advanced use cases.
 *
 * @packageDocumentation
 */

export { refreshSession } from "./refreshSession";
export type { DecodedToken, Session } from "./session";
export {
  detectStorage,
  type SessionChangeCallback,
  SessionStorage,
} from "./storage";
export {
  CookieStorage,
  DEFAULT_SESSION_KEY,
  LocalStorage,
  MemoryStorage,
  type SessionStorageBackend,
} from "./storageBackend";
