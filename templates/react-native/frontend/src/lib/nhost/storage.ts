import type {
  SessionStorageBackend,
  StoredSession,
} from '@nhost/nhost-js/session';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SESSION_KEY = 'nhostSession';

/**
 * Keeps the session in AsyncStorage so it survives the app being closed.
 *
 * The SDK's storage interface is synchronous - `get` returns the session, it
 * does not return a promise for it - and AsyncStorage is not. So the session
 * is held in memory, which is what `get` answers from, and every write is
 * mirrored to AsyncStorage in the background. Reads never wait, which is what
 * the interface requires, and the copy on disk is what the next launch starts
 * from.
 *
 * That leaves one thing the caller has to do: `hydrate` before the client is
 * asked for a session, or the first `get` of a launch answers null and the
 * user looks signed out despite having a stored session. `AuthProvider` awaits
 * it before rendering.
 *
 * A failed write is logged rather than thrown. The session in memory is still
 * good, so the app keeps working and the user is signed in; what is lost is
 * only that this session survives a restart.
 */
export class AsyncSessionStorage implements SessionStorageBackend {
  private session: StoredSession | null = null;

  get(): StoredSession | null {
    return this.session;
  }

  set(value: StoredSession): void {
    this.session = value;

    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(value)).catch((err) => {
      console.error('Could not save the session to storage:', err);
    });
  }

  remove(): void {
    this.session = null;

    AsyncStorage.removeItem(SESSION_KEY).catch((err) => {
      console.error('Could not clear the session from storage:', err);
    });
  }

  /**
   * Reads the stored session into memory. Call once, before the client is
   * used.
   *
   * Anything unreadable is dropped rather than thrown: a session written by an
   * older version of the app, or a half-written one, should land the user at
   * signed out and not at a crash on launch.
   */
  async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);

      this.session = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch (err) {
      console.error('Could not read the stored session:', err);
      this.session = null;
    }
  }
}
