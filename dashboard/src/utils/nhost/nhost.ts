import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getStorageServiceUrl,
} from '@/utils/env';
import { createClient } from '@nhost/nhost-js-beta';
import { type Session } from '@nhost/nhost-js-beta/auth';
import { type SessionStorageBackend } from '@nhost/nhost-js-beta/session';

const nhost = createClient({
  authUrl: getAuthServiceUrl(),
  graphqlUrl: getGraphqlServiceUrl(),
  functionsUrl: getFunctionsServiceUrl(),
  storageUrl: getStorageServiceUrl(),
});

export class DummySessionStorage implements SessionStorageBackend {
  private session: Session | null = null;

  /**
   * Get the current session from memory storage
   * @returns The stored session or null if not found
   */
  get(): Session | null {
    return this.session;
  }

  /**
   * Set the session in memory storage
   * @param value - The session to store
   */
  set(value: Session): void {
    this.session = value;
  }

  /**
   * Remove the session from memory storage
   */
  remove(): void {
    this.session = null;
  }
}

export default nhost;
