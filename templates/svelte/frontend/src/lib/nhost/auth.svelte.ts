import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { Session } from '@nhost/nhost-js/auth';
import { nhostRegion, nhostSubdomain } from '$lib/nhost/env';
import { redeemLinkToken } from '$lib/nhost/linkToken';

/**
 * The one Nhost client this app uses.
 *
 * `createClient` is the browser client: it keeps the session in
 * `localStorage` and refreshes the access token itself, through the default
 * middleware, whenever a request goes out within 60s of expiry. That is the
 * whole session design here. Nothing on a server is involved, so nothing else
 * is rotating the refresh token and there is no second writer to arbitrate
 * with.
 *
 * It is a module-level constant rather than something a component creates: the
 * client owns the refresh timer and the in-flight-refresh deduplication, so a
 * second instance would be a second rotator of a single-use token. This app
 * never renders on a server - `+layout.ts` turns SSR off - so there is no
 * request whose state could leak into the next one through module scope.
 */
const nhost: NhostClient = createClient({
  subdomain: nhostSubdomain(),
  region: nhostRegion(),
});

// `$state` in a `.svelte.ts` module: the rune works anywhere that filename
// suffix is used, so the session is shared reactive state without a store
// wrapper around it.
let session = $state<Session | null>(null);

// Fires for this tab's own writes and for other tabs', so signing out in one
// tab signs out the rest. Subscribed at module scope, before `startAuth`
// redeems a token, so the session that redemption stores is not missed.
nhost.sessionStorage.onChange((next) => {
  session = next;
});

/**
 * Reads the stored session, redeeming a token on the URL first.
 *
 * The root `+layout.ts` awaits this, so it has finished before the first page
 * renders: a signed-in visitor never flashes as signed out, and a protected
 * page never bounces them in that frame. It costs nothing on an ordinary load,
 * because with no token on the URL `redeemLinkToken` returns without a
 * request.
 */
export async function startAuth(): Promise<void> {
  // An arrival from an auth email or an OAuth callback carries the session on
  // the URL, so it has to be taken before the first read or the visitor
  // renders as signed out and the token is lost.
  await redeemLinkToken(nhost);

  session = nhost.getUserSession();
}

type AuthValue = {
  nhost: NhostClient;
  readonly session: Session | null;
};

/**
 * The client and the current session, for any component that needs either.
 *
 * `session` is a getter rather than a value: that is what keeps it reactive
 * through the call, so a component reading `auth.session` re-renders when the
 * storage subscription above replaces it.
 */
export function useAuth(): AuthValue {
  return {
    nhost,
    get session() {
      return session;
    },
  };
}
