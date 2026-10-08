import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { useState } from 'react';
import { View } from 'react-native';
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
import { useGo, useParams } from '@/lib/navigation';
import { useAuth } from '@/lib/nhost/AuthProvider';

// Inline for the same reason as the sign-in screen's calls: Expo Router turns
// every file under `src/app` into a route, so a method's code lives in the
// file that is its route.
async function setNewPassword(
  nhost: NhostClient,
  newPassword: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!newPassword) {
    return { error: 'A new password is required.' };
  }

  try {
    if (!nhost.getUserSession()) {
      return { error: 'The reset link has expired. Request another.' };
    }

    await nhost.auth.changeUserPassword({ newPassword });

    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not change the password: ${error.message}` };
  }
}

// The reset email's link goes through the auth service, which reopens this app
// on a deep link carrying a refresh token that `lib/nhost/linkToken.ts`
// redeems, or an error when the link expired or was already used. The error
// is checked first: a user who was already signed in still has a session when
// the link fails, and it is not the link's. Nor does a session prove the link
// signed them in, since a link never replaces one, so the form says whose
// password it changes rather than how they got here.
export default function ResetPasswordScreen() {
  const { nhost, session, isLoading } = useAuth();
  const go = useGo();
  // Off this screen's own link rather than `useAuth().linkError`, which the
  // user can dismiss: dismissing the reason must not bring the form back.
  const { error: linkFailed } = useParams<{ error: string }>();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await setNewPassword(nhost, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      // They are already signed in, so there is nowhere to send them but on into
      // the app.
      go.replace('/protected');
    } catch (err) {
      console.error('Error changing the password:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  // `isLoading` stays true until the link that opened this screen has been
  // redeemed, so waiting is what keeps a working link from being reported as
  // expired.
  if (isLoading) {
    return null;
  }

  if (linkFailed || !session) {
    return (
      <Screen>
        <Card>
          <CardHeader>
            <CardTitle>This link no longer works</CardTitle>
            <CardDescription>
              {/* With an error, the notice above already says why. */}
              {linkFailed ? null : 'It has expired or was already used. '}
              Request another one and open it on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onPress={() => go.replace('/auth/password')}>
              Request a new link
            </Button>
          </CardContent>
        </Card>
      </Screen>
    );
  }

  const account =
    session.user?.email ?? session.user?.phoneNumber ?? 'this account';

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            You are signed in as {account}. The new password is for that
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <View className="gap-2">
            <Label>New password</Label>
            <Input
              accessibilityLabel="New password"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isPending}
            />
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Button
            isPending={isPending}
            disabled={!password}
            onPress={() => void handleSubmit()}
          >
            {isPending ? 'Saving…' : 'Save the new password'}
          </Button>
        </CardContent>
      </Card>
    </Screen>
  );
}
