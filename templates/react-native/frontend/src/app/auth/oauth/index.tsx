import type { NhostClient } from '@nhost/nhost-js';
import type { SignInProvider } from '@nhost/nhost-js/auth';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { ErrorText } from '@/components/ui/ErrorText';
import { useGo } from '@/lib/navigation';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { readLinkError, redeemLinkToken } from '@/lib/nhost/linkToken';
import { authRedirectURL } from '@/lib/nhost/redirect';
import { OtherWaysLink } from '@/signin/OtherWaysLink';
import { useNext } from '@/signin/useNext';

/**
 * The providers this screen offers. Adding one is a line here and a section in
 * `nhost.toml`; the button and the round-trip are the same for all of them.
 */
const providers = [
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'google', label: 'Continue with Google' },
] as const satisfies ReadonlyArray<{ id: SignInProvider; label: string }>;

/**
 * Runs the provider round-trip and signs the user in.
 *
 * This is where native differs most from the web. A browser app sends the page
 * to the auth service and never sees the callback: it comes back as a fresh
 * page load with a token on the URL. There is no page to leave here, so the
 * app opens the system browser as a modal session instead and is handed the
 * callback URL when it closes. That URL carries the refresh token, which is
 * redeemed the same way a deep link's would be, or an error when the provider
 * is not enabled or refused the sign-in.
 *
 * `openAuthSessionAsync` is what makes it a session rather than just opening a
 * browser: it is tied to this app, so the callback comes straight back and the
 * user is returned to where they were.
 */
async function signInWithProvider(
  nhost: NhostClient,
  provider: SignInProvider,
  next: string,
): Promise<{ error?: string; linkError?: string; success?: boolean }> {
  const returnTo = authRedirectURL(next);

  const authUrl = nhost.auth.signInProviderURL(provider, {
    redirectTo: returnTo,
  });

  // Read before the browser opens: on Android the callback can also arrive as
  // a link event and be redeemed before this screen is handed it.
  const signedInBefore = nhost.getUserSession() !== null;

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, returnTo);

    // `dismiss` and `cancel` have nothing to report. Usually the user closed
    // the browser, but on Android `dismiss` only means the app came back to
    // the front, which the callback itself can cause. That callback still
    // arrives as a link event: `AuthProvider` redeems it and the router
    // follows it to `next`, so this must not be read as a failed sign-in.
    if (result.type !== 'success') {
      return {};
    }

    // Shown in the notice a failed email link uses rather than under the
    // buttons: on Android this same callback can also arrive as a link event,
    // which reports it there, and two places would say it twice.
    const linkError = readLinkError(result.url);

    if (linkError) {
      return { linkError };
    }

    await redeemLinkToken(nhost, result.url);

    // Only a session where there was none is this sign-in. A link never
    // replaces a signed-in user, so one who was here before still is,
    // whatever the callback said.
    if (nhost.getUserSession()) {
      return signedInBefore
        ? { error: 'You are already signed in. Sign out first.' }
        : { success: true };
    }

    return { error: 'That sign-in did not complete. Try again.' };
  } catch (err) {
    console.error('Error signing in with a provider:', err);

    return { error: 'Could not reach the provider. Try again.' };
  }
}

export default function OAuthScreen() {
  const { nhost, setLinkError } = useAuth();
  const go = useGo();
  const next = useNext();

  const [pending, setPending] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handlePress = async (id: (typeof providers)[number]['id']) => {
    setError(undefined);
    setLinkError(null);
    setPending(id);
    try {
      const result = await signInWithProvider(nhost, id, next);
      if (result.linkError) {
        setLinkError(result.linkError);
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.success) {
        go.replace(next);
      }
    } finally {
      setPending(undefined);
    }
  };

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>GitHub or Google</CardTitle>
          <CardDescription>Sign in with a provider account.</CardDescription>
        </CardHeader>
        <CardContent>
          {providers.map(({ id, label }) => (
            <Button
              key={id}
              variant="outline"
              isPending={pending === id}
              disabled={pending !== undefined}
              onPress={() => void handlePress(id)}
            >
              {label}
            </Button>
          ))}

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Text className="text-neutral-500 text-sm">
            A provider only works once it is enabled in nhost.toml, and the
            app's deep link has to be in auth.redirections.allowedUrls. The
            README's OAuth section has both.
          </Text>
          <OtherWaysLink />
        </CardContent>
      </Card>
    </Screen>
  );
}
