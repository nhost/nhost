'use client';

import {
  createNhostClient,
  withServerSideSessionMiddleware,
} from '@nhost/nhost-js';
import { CookieStorage } from '@nhost/nhost-js/session';
import { nhostRegion, nhostSubdomain } from './env';

// `createNhostClient` with the server-side middleware set, not `createClient`.
// `createClient`'s default middleware refreshes the access token itself
// whenever it is within 60s of expiring, before every request - the same
// margin `handleNhostProxy` (`server.ts`) already refreshes with on every
// navigation. Both would rotate the same single-use refresh token, and
// nothing arbitrates between them: `navigator.locks` only serialises other
// client-side refreshes in this tab, not a concurrent server-side one. The
// loser's rotation attempt fails against a token the winner already spent,
// and the SDK reacts to that failure by deleting the session - client-side
// via `CookieStorage.remove()`, or server-side via the proxy's response
// cookie - wiping out the winner's still-valid, freshly rotated session.
// Using only the attach/update-from-response middleware makes this client a
// reader of whatever token the proxy last wrote, never a second rotator. The
// proxy's 60s margin keeps that token usable for the time between
// navigations; a tab left open past that turns an expired-token request into
// an ordinary, visible error instead of a silent sign-out.
export const nhost = createNhostClient({
  subdomain: nhostSubdomain(),
  region: nhostRegion(),
  storage: new CookieStorage({
    secure: process.env.NODE_ENV === 'production',
  }),
  configure: [withServerSideSessionMiddleware],
});
