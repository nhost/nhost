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
import { redeemLinkToken } from '@/lib/nhost/linkToken';
import { authRedirectURL } from '@/lib/nhost/redirect';

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
 * redeemed the same way a deep link's would be.
 *
 * `openAuthSessionAsync` is what makes it a session rather than just opening a
 * browser: it is tied to this app, so the callback comes straight back and the
 * user is returned to where they were.
 */
async function signInWithProvider(
  nhost: NhostClient,
  provider: SignInProvider,
  next: string,
): Promise<{ error?: string; success?: boolean }> {
  const returnTo = authRedirectURL(next);

  const authUrl = nhost.auth.signInProviderURL(provider, {
    redirectTo: returnTo,
  });

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, returnTo);

    // `dismiss` and `cancel` are the user closing the browser, which is not a
    // failure and has nothing to report.
    if (result.type !== 'success') {
      return {};
    }

    await redeemLinkToken(nhost, result.url);

    if (!nhost.getUserSession()) {
      return { error: 'That sign-in did not complete. Try again.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error signing in with a provider:', err);

    return { error: 'Could not reach the provider. Try again.' };
  }
}

import { useNext } from '@/signin/useNext';

export default function OAuthScreen() {
  const { nhost } = useAuth();
  const go = useGo();
  const next = useNext();

  const [pending, setPending] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handlePress = async (id: (typeof providers)[number]['id']) => {
    setError(undefined);
    setPending(id);
    try {
      const result = await signInWithProvider(nhost, id, next);
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

          <Text
            accessibilityRole="link"
            className="text-neutral-500 text-sm underline"
            onPress={() => go.push('/signin')}
          >
            Other ways to sign in
          </Text>
        </CardContent>
      </Card>
    </Screen>
  );
}
