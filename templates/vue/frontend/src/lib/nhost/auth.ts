import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { Session } from '@nhost/nhost-js/auth';
import { type Ref, readonly, shallowRef } from 'vue';
import { nhostRegion, nhostSubdomain } from '@/lib/nhost/env';
import { readLinkError, redeemLinkToken } from '@/lib/nhost/linkToken';

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
 * second instance would be a second rotator of a single-use token. Importing
 * this module anywhere gets the same one. There is no server-side rendering
 * here, so there is no request to leak state across either.
 */
const nhost: NhostClient = createClient({
  subdomain: nhostSubdomain(),
  region: nhostRegion(),
});

// `shallowRef` because a Session is plain data this app only ever replaces,
// never edits in place. Deep reactivity would walk the whole object on every
// sign-in to install proxies nothing reads through.
const session = shallowRef<Session | null>(null);

// Why the link or provider redirect this page load arrived from did not sign
// the visitor in, or null when it did not arrive from a failed one.
const linkError = shallowRef<string | null>(null);

// Fires for this tab's own writes and for other tabs', so signing out in one
// tab signs out the rest. Subscribed at module scope, before `startAuth`
// redeems a token, so the session that redemption stores is not missed.
nhost.sessionStorage.onChange((next) => {
  session.value = next;
});

/**
 * Reads the stored session, redeeming a token on the URL first.
 *
 * `main.ts` awaits this before mounting, which is what keeps a signed-in
 * visitor from rendering as signed out for a frame on a full page load, and
 * keeps a protected route from bouncing them in that frame. It costs nothing
 * on an ordinary load: with no token on the URL `redeemLinkToken` returns
 * without a request.
 */
export async function startAuth(): Promise<void> {
  // An arrival from an auth email or an OAuth callback carries the session on
  // the URL, so it has to be taken before the first read or the visitor
  // renders as signed out and the token is lost. A failed one carries an
  // error instead, read here because redeeming takes it off the URL.
  linkError.value = readLinkError();
  await redeemLinkToken(nhost);

  session.value = nhost.getUserSession();
}

type AuthValue = {
  nhost: NhostClient;
  session: Readonly<Ref<Session | null>>;
  linkError: Readonly<Ref<string | null>>;
  clearLinkError: () => void;
};

const clearLinkError = (): void => {
  linkError.value = null;
};

/**
 * The client and the current session, for any component that needs either.
 *
 * `session` is read-only: it is written by the storage subscription above, so
 * a component assigning to it would be overwritten by the next change and
 * would not have signed anyone in anyway.
 */
export function useAuth(): AuthValue {
  return {
    nhost,
    session: readonly(session) as Readonly<Ref<Session | null>>,
    linkError: readonly(linkError),
    clearLinkError,
  };
}
