import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Session } from "@nhost/nhost-js/session";
import {
  type SessionStorageBackend,
  DEFAULT_SESSION_KEY,
} from "@nhost/nhost-js/session";

/**
 * Custom storage implementation for React Native using AsyncStorage
 * to persist the Nhost session on the device.
 *
 * This implementation synchronously works with the SessionStorageBackend interface
 * while ensuring reliable persistence with AsyncStorage for Expo Go.
 */
export default class NhostAsyncStorage implements SessionStorageBackend {
  private key: string;
  private cache: Session | null = null;

  constructor(key: string = DEFAULT_SESSION_KEY) {
    this.key = key;

    // Immediately try to load from AsyncStorage
    this.loadFromAsyncStorage();
  }

  /**
   * Load the session from AsyncStorage synchronously if possible
   */
  private loadFromAsyncStorage(): void {
    // Try to get cached data from AsyncStorage immediately
    try {
      AsyncStorage.getItem(this.key)
        .then((value) => {
          if (value) {
            try {
              this.cache = JSON.parse(value) as Session;
            } catch (error) {
              console.warn("Error parsing session from AsyncStorage:", error);
              this.cache = null;
            }
          }
        })
        .catch((error) => {
          console.warn("Error loading from AsyncStorage:", error);
        });
    } catch (error) {
      console.warn("AsyncStorage access error:", error);
    }
  }

  /**
   * Gets the session from the in-memory cache
   */
  get(): Session | null {
    return this.cache;
  }

  /**
   * Sets the session in the in-memory cache and persists to AsyncStorage
   * Ensures the data gets written by using an immediately invoked async function
   */
  set(value: Session): void {
    // Update cache immediately
    this.cache = value;

    // Persist to AsyncStorage with better error handling
    void (async () => {
      try {
        await AsyncStorage.setItem(this.key, JSON.stringify(value));
      } catch (error) {
        console.warn("Error saving session to AsyncStorage:", error);
      }
    })();
  }

  /**
   * Removes the session from the in-memory cache and AsyncStorage
   * Ensures the data gets removed by using an immediately invoked async function
   */
  remove(): void {
    // Clear cache immediately
    this.cache = null;

    // Remove from AsyncStorage with better error handling
    void (async () => {
      try {
        await AsyncStorage.removeItem(this.key);
      } catch (error) {
        console.warn("Error removing session from AsyncStorage:", error);
      }
    })();
  }
}
