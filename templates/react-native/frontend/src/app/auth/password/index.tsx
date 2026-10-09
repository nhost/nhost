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
import { useGo } from '@/lib/navigation';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { authRedirectURL } from '@/lib/nhost/redirect';
import { OtherWaysLink } from '@/signin/OtherWaysLink';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

// The calls this screen makes, kept here rather than in a module beside it.
// Expo Router turns every file under `src/app` into a route, including ones
// that export no component, so a method's code lives in the file that is its
// route. `lib/nhost/redirect.ts` is where the one security-relevant decision
// went, so it can be tested once for every method.
type ActionResult = { error?: string; success?: boolean };

function errorMessage(err: unknown): string {
  return (err as FetchError<ErrorResponse>).message;
}

// The client stores the session as the response comes back, so a sign-in that
// succeeds here is the sign-in. The caller only has to navigate.
async function signIn(
  nhost: NhostClient,
  email: string,
  password: string,
): Promise<ActionResult> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  try {
    const { body } = await nhost.auth.signInEmailPassword({ email, password });

    if (!body.session) {
      // MFA or an unverified email: the backend accepted the password but did
      // not issue a session. Neither is set up by this template.
      return { error: 'That account cannot be signed in with a password.' };
    }

    return { success: true };
  } catch (err) {
    return { error: `Could not sign in: ${errorMessage(err)}` };
  }
}

// Returns `signedIn: true` only when the backend has email verification off.
// By default it is on, no session comes back, and the verification email's
// link is what signs the user in: it reopens this app on a deep link carrying
// a refresh token, which `lib/nhost/linkToken.ts` redeems.
async function signUp(
  nhost: NhostClient,
  email: string,
  password: string,
  next: string,
): Promise<ActionResult & { signedIn?: boolean }> {
  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  try {
    const { body } = await nhost.auth.signUpEmailPassword({
      email,
      password,
      options: { redirectTo: authRedirectURL(next) },
    });

    return { success: true, signedIn: Boolean(body.session) };
  } catch (err) {
    return { error: `Could not sign up: ${errorMessage(err)}` };
  }
}

// The reset link signs the user in and reopens the app on the reset screen,
// which is why that screen can set a password without asking for the current
// one.
async function requestPasswordReset(
  nhost: NhostClient,
  email: string,
): Promise<ActionResult> {
  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    await nhost.auth.sendPasswordResetEmail({
      email,
      options: { redirectTo: authRedirectURL('/auth/password/reset') },
    });

    return { success: true };
  } catch (err) {
    return { error: `Could not send the reset link: ${errorMessage(err)}` };
  }
}

type Mode = 'sign-in' | 'sign-up';

// What the screen shows once a request has gone out and there is nothing more
// to type: the next step happens in the user's inbox.
type Sent = 'verification' | 'reset';

export default function PasswordScreen() {
  const { nhost } = useAuth();
  const go = useGo();
  const next = useNext();
  const intent = useIntent();

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so a
  // sign-in form would be a dead end. After the toggle the route's intent is
  // stale, so the back link is given this instead.
  const [mode, setMode] = useState<Mode>(intent);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<Sent | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      if (mode === 'sign-in') {
        const result = await signIn(nhost, email, password);
        if (result.error) {
          setError(result.error);
          return;
        }

        go.replace(next);
        return;
      }

      const result = await signUp(nhost, email, password, next);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.signedIn) {
        go.replace(next);
        return;
      }

      setSent('verification');
    } catch (err) {
      console.error('Error submitting the form:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await requestPasswordReset(nhost, email);
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent('reset');
    } catch (err) {
      console.error('Error requesting the reset link:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <Card>
          <CardHeader>
            <CheckYourInbox />
            <CardDescription>
              {sent === 'verification'
                ? `We sent a verification link to ${email}. Opening it on this device confirms the address and signs you in.`
                : 'If that address has an account, a reset link is on its way. Open it on this device.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Email and password</CardTitle>
          <CardDescription>
            Sign in, or sign up and confirm your address by email.
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
              value={email}
              onChangeText={setEmail}
              editable={!isPending}
            />
          </View>

          <View className="gap-2">
            <Label>Password</Label>
            <Input
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete={
                mode === 'sign-in' ? 'current-password' : 'new-password'
              }
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isPending}
            />
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Button isPending={isPending} onPress={() => void handleSubmit()}>
            {mode === 'sign-in'
              ? isPending
                ? 'Signing in…'
                : 'Sign in'
              : isPending
                ? 'Signing up…'
                : 'Sign up'}
          </Button>

          {/* The links' hitSlop needs mt-1 to clear the button above, and
              gap-y-8 to clear each other once wrapped. */}
          <View className="mt-1 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-8">
            <Button
              variant="link"
              size="link"
              disabled={isPending}
              onPress={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                setError(undefined);
              }}
            >
              {mode === 'sign-in'
                ? 'Create an account'
                : 'I already have an account'}
            </Button>
            {mode === 'sign-in' ? (
              <Button
                variant="link"
                size="link"
                disabled={isPending || !email}
                onPress={() => void handleForgotPassword()}
              >
                Forgot your password?
              </Button>
            ) : null}
          </View>
          <OtherWaysLink intent={mode} />
        </CardContent>
      </Card>
    </Screen>
  );
}
