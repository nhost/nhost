import { type Client as AuthClient, type ErrorResponse } from "../auth";
import { type Session } from "./session";

import { type SessionStorage } from "./storage";
import type { FetchResponse } from "../fetch";

class DummyLock implements Lock {
  async request(
    _name: string,
    _options: { mode: "exclusive" | "shared" },
    callback: () => Promise<any>, //eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    return callback(); //eslint-disable-line @typescript-eslint/no-unsafe-return
  }
}

interface Lock {
  request: (
    name: string,
    options: { mode: "exclusive" | "shared" },
    callback: () => Promise<any>, //eslint-disable-line @typescript-eslint/no-explicit-any
  ) => Promise<any>; //eslint-disable-line @typescript-eslint/no-explicit-any
}

const lock: Lock =
  typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks
    : new DummyLock();

/**
 * Refreshes the authentication session if needed
 *
 * This function checks if the current session needs to be refreshed based on
 * the access token expiration time. If a refresh is needed, it will attempt to
 * refresh the token using the provided auth client.
 *
 * @param auth - The authentication client to use for token refresh
 * @param storage - The session storage implementation
 * @param marginSeconds - The number of seconds before the token expiration to refresh the session. If the token is still valid for this duration, it will not be refreshed. Set to 0 to force the refresh.
 * @returns A promise that resolves to the current session (refreshed if needed) or null if no session exists
 */
export const refreshSession = async (
  auth: AuthClient,
  storage: SessionStorage,
  marginSeconds = 60,
): Promise<Session | null> => {
  try {
    return await _refreshSession(auth, storage, marginSeconds);
  } catch (error) {
    try {
      // we retry the refresh token in case of transient error
      // or race conditions
      console.warn("error refreshing session, retrying:", error);
      return await _refreshSession(auth, storage, marginSeconds);
    } catch (error) {
      const errResponse = error as FetchResponse<ErrorResponse>;
      if (errResponse?.status === 401) {
        // this probably means the refresh token is invalid
        console.error("session probably expired");
        storage.remove();
      }
      return null;
    }
  }
};

/**
 * Internal implementation of the refresh session logic
 *
 * @param auth - The authentication client to use for token refresh
 * @param storage - The session storage implementation
 * @param marginSeconds - How many seconds before expiration to trigger a refresh
 * @returns A promise that resolves to the current session (refreshed if needed) or null if no session exists
 * @private
 */
const _refreshSession = async (
  auth: AuthClient,
  storage: SessionStorage,
  marginSeconds = 60,
): Promise<Session | null> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const {
    session,
    needsRefresh,
  }: { session: Session | null; needsRefresh: boolean } =
    //eslint-disable-next-line @typescript-eslint/require-await
    await lock.request("nhostSessionLock", { mode: "shared" }, async () => {
      return _needsRefresh(storage, marginSeconds);
    });

  if (!session) {
    return null; // No session found
  }

  if (!needsRefresh) {
    return session; // No need to refresh
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const refreshedSession: Session | null = await lock.request(
    "nhostSessionLock",
    { mode: "exclusive" },
    async () => {
      const { session, needsRefresh, sessionExpired } = _needsRefresh(
        storage,
        marginSeconds,
      );

      if (!session) {
        return null; // No session found
      }

      if (!needsRefresh) {
        return session; // No need to refresh
      }

      try {
        const response = await auth.refreshToken({
          refreshToken: session.refreshToken,
        });
        storage.set(response.body);

        return response.body;
      } catch (error) {
        if (!sessionExpired) {
          return session;
        }

        throw error;
      }
    },
  );

  return refreshedSession;
};

/**
 * Checks if the current session needs to be refreshed based on token expiration
 *
 * @param storage - The session storage implementation
 * @param marginSeconds - How many seconds before expiration to trigger a refresh
 * @returns An object containing the session, whether it needs refreshing, and whether it has expired
 * @private
 */
const _needsRefresh = (storage: SessionStorage, marginSeconds = 60) => {
  const session = storage.get();
  if (!session) {
    return { session: null, needsRefresh: false, sessionExpired: false };
  }

  if (!session.decodedToken || !session.decodedToken.exp) {
    // if the session does not have a valid decoded token, treat it as expired
    // as we can't determine its validity
    return { session, needsRefresh: true, sessionExpired: true };
  }

  // Force refresh if marginSeconds is 0
  if (marginSeconds === 0) {
    return { session, needsRefresh: true, sessionExpired: false };
  }

  const currentTime = Date.now();
  if (session.decodedToken.exp - currentTime > marginSeconds * 1000) {
    return { session, needsRefresh: false, sessionExpired: false };
  }

  return {
    session,
    needsRefresh: true,
    sessionExpired: session.decodedToken.exp < currentTime,
  };
};
