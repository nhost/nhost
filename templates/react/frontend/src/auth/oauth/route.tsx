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
import OtherWaysLink from '@/signin/OtherWaysLink';
import { signInQuery } from '@/signin/query';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

/**
 * Sign in with a provider account.
 *
 * This is a redirect, not a request: each button sends the browser to the
 * auth service, which does the provider round-trip and comes back to
 * `redirectTo` with a refresh token on the URL, or with an error when the
 * provider is not enabled or the sign-in was refused. `lib/nhost/linkToken.ts`
 * handles both when the app loads again, redeeming the token or putting the
 * error in the notice above the page, so this page never sees the callback.
 */
export default function OAuthPage() {
  const { nhost } = useAuth();
  const next = useNext();
  const intent = useIntent();
  const query = signInQuery(next, intent);

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
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
