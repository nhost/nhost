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

export {
  SessionStorage,
  type SessionChangeCallback,
  detectStorage,
} from "./storage";
export {
  type SessionStorageBackend,
  DEFAULT_SESSION_KEY,
  LocalStorage,
  MemoryStorage,
  CookieStorage,
} from "./storageBackend";
export type { Session, DecodedToken } from "./session";
export { refreshSession } from "./refreshSession";
