import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient } from '@/lib/nhost/server';
import OAuthButtons from './OAuthButtons';
import { configuredProviders } from './providers';

/**
 * A button for each provider the deployment set up, shown on the sign-in list
 * itself. A provider needs nothing typed first, so a page of its own would
 * only be a second click on the same choice.
 *
 * This is a redirect, not a request: each button sends the browser to the auth
 * service, which does the provider round-trip and comes back to `redirectTo`
 * with a refresh token on the URL. The proxy redeems that token (see
 * `lib/nhost/server.ts`), so nothing here sees the callback. Signing up and
 * signing in are the same trip, so the intent is not passed on.
 */
export default async function ProviderSignIn({
  destination,
}: {
  destination: string;
}) {
  const nhost = await createNhostClient();
  const links = configuredProviders().map(({ id, label }) => ({
    id,
    label,
    href: nhost.auth.signInProviderURL(id, {
      redirectTo: appOrigin() + destination,
    }),
  }));

  return <OAuthButtons links={links} />;
}
