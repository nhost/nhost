import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { useState } from 'react';
import { View } from 'react-native';
import { CheckYourInbox } from '@/components/CheckYourInbox';
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
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { authRedirectURL } from '@/lib/nhost/redirect';
import { OtherWaysLink } from '@/signin/OtherWaysLink';
import { useNext } from '@/signin/useNext';

/**
 * Emails a sign-in link. Opening it on the device reopens this app on a deep
 * link carrying a refresh token, which `lib/nhost/linkToken.ts` redeems, so
 * there is nothing for this method to do after the email is out.
 *
 * Inline rather than in a module beside this one: Expo Router turns every file
 * under `src/app` into a route, so a method's code lives in the file that is
 * its route.
 */
async function sendMagicLink(
  nhost: NhostClient,
  email: string,
  next: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    await nhost.auth.signInPasswordlessEmail({
      email,
      options: { redirectTo: authRedirectURL(next) },
    });

    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the link: ${error.message}` };
  }
}

/**
 * Magic link sign-in. The screen only sends the email: the link in it goes to
 * the auth service, which signs the user in and reopens this app on a deep
 * link carrying a refresh token that `lib/nhost/linkToken.ts` redeems.
 *
 * The link has to be opened on this device: it is the device's own app the
 * scheme resolves to.
 */
export default function MagicLinkScreen() {
  const { nhost } = useAuth();
  const next = useNext();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    setError(undefined);
    setIsSending(true);
    try {
      const result = await sendMagicLink(nhost, email, next);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setSent(true);
    } catch (err) {
      console.error('Error sending the magic link:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <Card>
          <CardHeader>
            <CheckYourInbox />
            <CardDescription>
              A sign-in link is on its way to {email}. Open it on this device
              and it signs you in here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                setSent(false);
                setEmail('');
                setError(undefined);
              }}
            >
              Use a different address
            </Button>
          </CardContent>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Magic link</CardTitle>
          <CardDescription>
            Enter your email and we will send you a link that signs you in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <View className="gap-2">
            <Label>Email</Label>
            <Input
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              editable={!isSending}
            />
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Button
            isPending={isSending}
            disabled={!email}
            onPress={() => void handleSubmit()}
          >
            {isSending ? 'Sending…' : 'Send me a link'}
          </Button>
          <OtherWaysLink />
        </CardContent>
      </Card>
    </Screen>
  );
}
