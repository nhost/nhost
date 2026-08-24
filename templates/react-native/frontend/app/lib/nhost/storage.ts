import {
  DEFAULT_SESSION_KEY,
  type SessionStorageBackend,
  type StoredSession,
} from '@nhost/nhost-js/session';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Nhost session storage for React Native.
 *
 * The Nhost client reads and writes the session synchronously, while
 * AsyncStorage is async, so we keep an in-memory cache that is hydrated from
 * AsyncStorage on startup and written through on every change.
 */
export class NhostAsyncStorage implements SessionStorageBackend {
  private readonly key: string;
  private cache: StoredSession | null = null;

  constructor(key: string = DEFAULT_SESSION_KEY) {
    this.key = key;
    this.hydrate();
  }

  private hydrate(): void {
    AsyncStorage.getItem(this.key)
      .then((value) => {
        if (value) {
          try {
            this.cache = JSON.parse(value) as StoredSession;
          } catch {
            this.cache = null;
          }
        }
      })
      .catch((error) => {
        console.warn('Failed to read the Nhost session:', error);
      });
  }

  get(): StoredSession | null {
    return this.cache;
  }

  set(value: StoredSession): void {
    this.cache = value;
    void AsyncStorage.setItem(this.key, JSON.stringify(value)).catch(
      (error) => {
        console.warn('Failed to persist the Nhost session:', error);
      },
    );
  }

  remove(): void {
    this.cache = null;
    void AsyncStorage.removeItem(this.key).catch((error) => {
      console.warn('Failed to clear the Nhost session:', error);
    });
  }
}
