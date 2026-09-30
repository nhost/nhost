import Link from 'next/link';
import { signInDestination } from '@/app/signin/destination';
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
import { providers } from './providers';

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
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = signInDestination(next);

  const nhost = await createNhostClient();
  const links = providers.map(({ id, label }) => ({
    id,
    label,
    href: nhost.auth.signInProviderURL(id, {
      redirectTo: appOrigin() + destination,
    }),
  }));

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>GitHub or Google</CardTitle>
          <CardDescription>Sign in with a provider account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <OAuthButtons links={links} />
          <p className="text-muted-foreground text-sm">
            A provider only works once it is enabled in <code>nhost.toml</code>.
            The README&apos;s OAuth section has the callback URL and the config.
          </p>
          <Link
            href="/signin"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Other ways to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
