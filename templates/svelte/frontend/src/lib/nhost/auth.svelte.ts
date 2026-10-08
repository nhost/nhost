import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { Session } from '@nhost/nhost-js/auth';
import { nhostRegion, nhostSubdomain } from '$lib/nhost/env';
import { readLinkError, redeemLinkToken } from '$lib/nhost/linkToken';
import { watchSession } from '$lib/nhost/watchSession';

/**
 * The one Nhost client this app uses.
 *
 * `createClient` is the browser client: it keeps the session in
 * `localStorage` and refreshes the access token itself, through the default
 * middleware, whenever a request goes out within 60s of expiry. There is no
 * timer: a tab that sends nothing refreshes nothing. Nothing on a server is
 * involved. The only other writers are this app's other tabs, and the SDK
 * serialises refreshes with `navigator.locks`, which every client on the
 * origin shares, so two tabs do not spend the same single-use refresh token.
 *
 * It is a module-level constant rather than something a component creates
 * because the session here follows it: `sessionStorage.onChange` hears only
 * writes made through this instance, so a sign-in or sign-out through a second
 * client would leave the app rendering the old visitor. This app never renders
 * on a server - `+layout.ts` turns SSR off - so there is no request whose
 * state could leak into the next one through module scope.
 */
const nhost: NhostClient = createClient({
  subdomain: nhostSubdomain(),
  region: nhostRegion(),
});

// `$state` in a `.svelte.ts` module: the rune works anywhere that filename
// suffix is used, so the session is shared reactive state without a store
// wrapper around it.
let session = $state<Session | null>(null);

// Why the link or provider redirect this page load arrived from did not sign
// the visitor in, or null when it did not arrive from a failed one.
let linkError = $state<string | null>(null);

/**
 * Starts following the stored session, redeeming a token on the URL first.
 *
 * From then on `session` tracks this tab's own writes and other tabs', so
 * signing in or out in one tab does the same in the rest.
 *
 * `hooks.client.ts` calls this once and awaits it, so it has finished before
 * the first page renders: a signed-in visitor never flashes as signed out, and
 * a protected page never bounces them in that frame. It costs nothing on an
 * ordinary load, because with no token on the URL `redeemLinkToken` returns
 * without a request. It must not throw: a rejection there stops the app from
 * starting.
 */
export async function startAuth(): Promise<void> {
  // Started before the token is redeemed, so the session that redemption
  // stores is not missed.
  watchSession(nhost, (next) => {
    session = next;
  });

  // An arrival from an auth email or an OAuth callback carries the session on
  // the URL, so it has to be taken before the first read or the visitor
  // renders as signed out and the token is lost. A failed one carries an
  // error instead, read here because redeeming takes it off the URL.
  linkError = readLinkError();
  await redeemLinkToken(nhost);

  session = nhost.getUserSession();
}

type AuthValue = {
  nhost: NhostClient;
  readonly session: Session | null;
  readonly linkError: string | null;
  clearLinkError: () => void;
};

const clearLinkError = (): void => {
  linkError = null;
};

/**
 * The client and the current session, for any component that needs either.
 *
 * `session` and `linkError` are getters rather than values: that is what
 * keeps them reactive through the call, so a component reading `auth.session`
 * re-renders when the session watch above replaces it.
 */
export function useAuth(): AuthValue {
  return {
    nhost,
    get session() {
      return session;
    },
    get linkError() {
      return linkError;
    },
    clearLinkError,
  };
}
