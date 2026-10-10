'use client';

import {
  createNhostClient,
  withServerSideSessionMiddleware,
} from '@nhost/nhost-js';
import type { SessionStorageBackend } from '@nhost/nhost-js/session';
import { readAccessTokenCookie } from './access-token';
import { nhostRegion, nhostSubdomain } from './env';

// Reads the access token the proxy and server actions write next to the
// httpOnly session cookie, through `sessionCookies` in `server.ts`.
// Writes do nothing: the browser cannot touch the session cookie, and the only
// session it could be handed is from an auth call made here, which the proxy
// would not know to rotate. Sign in and out through server actions instead.
const accessTokenStorage: SessionStorageBackend = {
  get: () => readAccessTokenCookie(document.cookie),
  set: () => undefined,
  remove: () => undefined,
};

// `createNhostClient` with the server-side middleware set, not `createClient`.
// `createClient`'s default middleware refreshes the access token itself
// whenever it is within 60s of expiring, before every request - the same
// margin `handleNhostProxy` (`server.ts`) already refreshes with on every
// navigation. Here it would only fail, since the refresh token never reaches
// the browser, and giving it one would make two rotators of a single-use token
// that nothing arbitrates between. Using only the attach/update-from-response
// middleware makes this client a reader of whatever token the proxy last
// wrote. The proxy's 60s margin keeps that token usable for the time between
// navigations; in a tab left open past its expiry the cookie is gone, and
// requests go out as a signed-out visitor's would until the next navigation.
export const nhost = createNhostClient({
  subdomain: nhostSubdomain(),
  region: nhostRegion(),
  storage: accessTokenStorage,
  configure: [withServerSideSessionMiddleware],
});
