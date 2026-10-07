import { Link } from 'react-router';
import OAuthButtons from '@/auth/oauth/OAuthButtons';
import { providers } from '@/auth/oauth/providers';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { appOrigin } from '@/lib/nhost/env';
import { useNext } from '@/signin/useNext';

/**
 * Sign in with a provider account.
 *
 * This is a redirect, not a request: each button sends the browser to the
 * auth service, which does the provider round-trip and comes back to
 * `redirectTo` with a refresh token on the URL. That token is redeemed by
 * `lib/nhost/linkToken.ts` when the app loads again, so this page never sees
 * the callback.
 */
export default function OAuthPage() {
  const { nhost } = useAuth();
  const next = useNext();

  const links = providers.map(({ id, label }) => ({
    id,
    label,
    href: nhost.auth.signInProviderURL(id, {
      redirectTo: appOrigin() + next,
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
            to="/signin"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Other ways to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
