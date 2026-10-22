import { signInDestination } from '@/app/signin/destination';
import { signInIntent } from '@/app/signin/intent';
import OtherWaysLink from '@/app/signin/OtherWaysLink';
import { signInQuery } from '@/app/signin/query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient } from '@/lib/nhost/server';
import OAuthButtons from './OAuthButtons';
import { configuredProviders, providerNames } from './providers';

export const dynamic = 'force-dynamic';

/**
 * Sign in with a provider account.
 *
 * This is a redirect, not a request: each button sends the browser to the auth
 * service, which does the provider round-trip and comes back to `redirectTo`
 * with a refresh token on the URL. The proxy redeems that token (see
 * `lib/nhost/server.ts`), so this page never sees the callback.
 */
export default async function OAuth({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    intent?: string | string[];
  }>;
}) {
  const { next, intent } = await searchParams;
  const destination = signInDestination(next);
  const query = signInQuery(destination, signInIntent(intent));

  const configured = configuredProviders();
  const nhost = await createNhostClient();
  const links = configured.map(({ id, label }) => ({
    id,
    label,
    href: nhost.auth.signInProviderURL(id, {
      redirectTo: appOrigin() + destination,
    }),
  }));

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>
            {providerNames(configured) || 'Provider accounts'}
          </CardTitle>
          <CardDescription>Sign in with a provider account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* The sign-in list leaves this method out when nothing is set
              up, so only a typed or old link lands here empty. */}
          {links.length > 0 ? (
            <OAuthButtons links={links} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No provider is set up. The README&apos;s OAuth section has the
              steps, ending with listing it in{' '}
              <code>NHOST_OAUTH_PROVIDERS</code>.
            </p>
          )}
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
