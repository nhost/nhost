import type { NhostClient } from '@nhost/nhost-js';
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
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
import { localMailboxURL } from '@/lib/nhost/env';

type OtpActionResult = { error?: string; success?: boolean };

// Inline for the same reason as the other methods: Expo Router turns every
// file under `src/app` into a route, so a method's code lives in the file that
// is its route. There is no `redirectTo` anywhere here - the code comes back
// by hand, which is what makes this the one method that needs no deep link.
async function sendCode(
  nhost: NhostClient,
  email: string,
): Promise<OtpActionResult> {
  if (!email) {
    return { error: 'Enter your email address.' };
  }

  try {
    await nhost.auth.signInOTPEmail({ email });

    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not send the code: ${error.message}` };
  }
}

// A successful verify is the sign-in: the client stores the session as the
// response comes back, so the caller only has to navigate.
async function verifyCode(
  nhost: NhostClient,
  email: string,
  otp: string,
): Promise<OtpActionResult> {
  if (!email || !otp) {
    return { error: 'Enter your email address and the code.' };
  }

  try {
    const { body } = await nhost.auth.verifySignInOTPEmail({ email, otp });

    if (!body?.session) {
      return { error: 'That code did not work. Try again.' };
    }

    return { success: true };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return { error: `Could not verify the code: ${error.message}` };
  }
}

import { useNext } from '@/signin/useNext';

type Step = 'email' | 'code';

/**
 * The one method that needs no deep link at all: the code is typed back in
 * here, so the whole exchange finishes inside the app.
 */
export default function OtpScreen() {
  const { nhost } = useAuth();
  const go = useGo();
  const next = useNext();
  const mailboxURL = localMailboxURL();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const send = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await sendCode(nhost, email);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setOtp('');
      setStep('code');
    } catch (err) {
      console.error('Error sending the code:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  const handleVerify = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await verifyCode(nhost, email, otp);
      if (result?.error) {
        setError(result.error);
        return;
      }

      go.replace(next);
    } catch (err) {
      console.error('Error verifying the code:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Email code</CardTitle>
          <CardDescription>
            {step === 'code'
              ? `We sent a code to ${email}.`
              : 'We email you a one-time code and you type it in here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'code' ? (
            <>
              {mailboxURL ? (
                <Text
                  accessibilityRole="link"
                  className="text-neutral-500 text-sm underline"
                  onPress={() => void Linking.openURL(mailboxURL)}
                >
                  Running locally? Open the local mailbox
                </Text>
              ) : null}

              <View className="gap-2">
                <Label>Code</Label>
                <Input
                  accessibilityLabel="Code"
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  value={otp}
                  onChangeText={setOtp}
                  editable={!isPending}
                />
              </View>

              {error ? <ErrorText>{error}</ErrorText> : null}

              <Button
                isPending={isPending}
                disabled={!otp}
                onPress={() => void handleVerify()}
              >
                {isPending ? 'Signing in…' : 'Sign in'}
              </Button>

              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onPress={() => void send()}
                >
                  Send a new code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onPress={() => {
                    setStep('email');
                    setOtp('');
                    setError(undefined);
                  }}
                >
                  Use a different address
                </Button>
              </View>
            </>
          ) : (
            <>
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
                  editable={!isPending}
                />
              </View>

              {error ? <ErrorText>{error}</ErrorText> : null}

              <Button
                isPending={isPending}
                disabled={!email}
                onPress={() => void send()}
              >
                {isPending ? 'Sending…' : 'Send me a code'}
              </Button>
            </>
          )}

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
