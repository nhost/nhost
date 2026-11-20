// Runs before anything imports the SDK. Hermes already has the TextEncoder,
// TextDecoder, atob, btoa, URL and URLSearchParams the SDK uses. It has no
// `crypto`, which only the SDK's PKCE helper needs, so the app derives PKCE
// pairs with expo-crypto instead of installing a global.
import { ProcessLockManager } from './locks';

// Nor `navigator.locks`. The SDK picks its lock once, when it loads (nhost-js
// `src/session/refreshSession.ts`), and without one it runs concurrent
// refreshes at once: both spend the same single-use refresh token, and the
// loser's 401 can clear the session the winner just stored.
Object.defineProperty(navigator, 'locks', {
  value: new ProcessLockManager(),
  configurable: true,
});
