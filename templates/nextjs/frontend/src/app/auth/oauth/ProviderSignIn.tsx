import { DEFAULT_INTENT } from '@/app/signin/intent';
import { signInQuery } from '@/app/signin/query';
import OAuthButtons from './OAuthButtons';
import { configuredProviders, providerHref } from './providers';

/**
 * A button for each provider the deployment set up, shown on the sign-in list
 * itself. A provider needs nothing typed first, so a page of its own would
 * only be a second click on the same choice.
 *
 * This is a redirect, not a request: each button goes through this app's
 * route for the provider to the auth service, which does the provider
 * round-trip and comes back to where the visitor was going with a refresh
 * token on the URL. The proxy redeems that token (see `lib/nhost/server.ts`),
 * so nothing here sees the callback. Signing up and signing in are the same
 * trip, so the intent is not passed on.
 */
export default function ProviderSignIn({
  destination,
  lastUsed,
}: {
  destination: string;
  lastUsed: string | null;
}) {
  const links = configuredProviders().map(({ id, label }) => ({
    id,
    label,
    href: `${providerHref(id)}${signInQuery(destination, DEFAULT_INTENT)}`,
    lastUsed: providerHref(id) === lastUsed,
  }));

  return <OAuthButtons links={links} />;
}
