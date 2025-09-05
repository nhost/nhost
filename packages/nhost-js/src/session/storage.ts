/**
 * Storage implementations for session persistence in different environments.
 *
 * This module provides different storage adapters for persisting authentication sessions
 * across page reloads and browser sessions.
 */

import {
  type SessionStorageBackend,
  LocalStorage,
  MemoryStorage,
} from "./storageBackend";
import { decodeUserSession, type Session } from "./session";
import type { Session as AuthSession } from "../auth";

/**
 * Callback function type for session change subscriptions
 */
export type SessionChangeCallback = (session: Session | null) => void;

/**
 * A wrapper around any SessionStorageInterface implementation that adds
 * the ability to subscribe to session changes.
 */
export class SessionStorage {
  private readonly storage: SessionStorageBackend;
  private subscribers = new Set<SessionChangeCallback>();

  /**
   * Creates a new SessionStorage instance
   * @param storage - The underlying storage implementation to use
   */
  constructor(storage: SessionStorageBackend) {
    this.storage = storage;
  }

  /**
   * Gets the session from the underlying storage
   * @returns The stored session or null if not found
   */
  get(): Session | null {
    return this.storage.get();
  }

  /**
   * Sets the session in the underlying storage and notifies subscribers
   * @param value - The session to store
   */
  set(value: AuthSession): void {
    const decodedToken = decodeUserSession(value.accessToken);
    const decodedSession = {
      ...value,
      decodedToken: decodedToken,
    };

    this.storage.set(decodedSession);
    this.notifySubscribers(decodedSession);
  }

  /**
   * Removes the session from the underlying storage and notifies subscribers
   */
  remove(): void {
    this.storage.remove();
    this.notifySubscribers(null);
  }

  /**
   * Subscribe to session changes
   * @param callback - Function that will be called when the session changes
   * @returns An unsubscribe function to remove this subscription
   */
  onChange(callback: SessionChangeCallback) {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of a session change
   * @param session - The new session value or null if removed
   */
  private notifySubscribers(session: Session | null): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(session);
      } catch (error) {
        console.error("Error notifying subscriber:", error);
      }
    }
  }
}

/**
 * Detects the best available storage implementation for the current environment.
 *
 * The detection process follows this order:
 * 1. Try to use localStorage if we're in a browser environment
 * 2. Fall back to in-memory storage if localStorage isn't available
 *
 * @returns The best available storage implementation as a SessionStorageBackend
 */
export const detectStorage = (): SessionStorageBackend => {
  if (typeof window !== "undefined") {
    return new LocalStorage();
  }
  return new MemoryStorage();
};
