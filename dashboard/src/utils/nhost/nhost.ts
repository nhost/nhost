import { createClient, createNhostClient } from '@nhost/nhost-js';
import type {
  SessionStorageBackend,
  StoredSession,
} from '@nhost/nhost-js/session';
import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getStorageServiceUrl,
} from '@/utils/env';

const nhost = createClient({
  authUrl: getAuthServiceUrl(),
  graphqlUrl: getGraphqlServiceUrl(),
  functionsUrl: getFunctionsServiceUrl(),
  storageUrl: getStorageServiceUrl(),
});

const nhostRoutesClient = createNhostClient({
  authUrl: getAuthServiceUrl(),
  graphqlUrl: getGraphqlServiceUrl(),
  functionsUrl: getFunctionsServiceUrl(),
  storageUrl: getStorageServiceUrl(),
});

export class DummySessionStorage implements SessionStorageBackend {
  private session: StoredSession | null = null;

  /**
   * Get the current session from memory storage
   * @returns The stored session or null if not found
   */
  get(): StoredSession | null {
    return this.session;
  }

  /**
   * Set the session in memory storage
   * @param value - The session to store
   */
  set(value: StoredSession): void {
    this.session = value;
  }

  /**
   * Remove the session from memory storage
   */
  remove(): void {
    this.session = null;
  }
}

export { nhostRoutesClient };
export default nhost;
