import { router } from 'expo-router';
import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { goTo } from '@/lib/goTo';
import {
  beginSignIn,
  beginSignUp,
  finishSignIn,
  finishSignUp,
} from '@/screens/auth/passkey/actions';
import { noPasskeyHere, wasCancelled } from '@/screens/auth/passkey/cancelled';
import {
  startAuthentication,
  startRegistration,
  supportsPasskeys,
} from '@/screens/auth/passkey/ceremony';
import { deviceName } from '@/screens/auth/passkey/manage/names';
import { rememberPasskey } from '@/screens/auth/passkey/thisDevice';
import { DEFAULT_DESTINATION } from '@/screens/signin/destination';
import { DEFAULT_INTENT, type Intent } from '@/screens/signin/intent';
import { colors, fontSize } from '@/theme';

export default function PasskeyForm({
  next,
  intent,
}: {
  next: string;
  intent: Intent;
}) {
  const emailId = useId();

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so a
  // sign-in form would be a dead end.
  const [mode, setMode] = useState<Intent>(intent);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const switchMode = (): void => {
    const other = mode === 'sign-in' ? 'sign-up' : 'sign-in';
    setMode(other);
    setError(undefined);
    // "Other ways to sign in" is built from the route's params, so they have
    // to say which mode the visitor switched to.
    router.setParams({
      next: next === DEFAULT_DESTINATION ? undefined : next,
      intent: other === DEFAULT_INTENT ? undefined : other,
    });
  };

  const handleSubmit = async (): Promise<void> => {
    if (isPending) {
      return;
    }
    setError(undefined);

    if (!supportsPasskeys()) {
      setError('This device does not support passkeys.');
      return;
    }

    setIsPending(true);
    try {
      if (mode === 'sign-in') {
        const begun = await beginSignIn();
        if (begun.error || !begun.options) {
          setError(begun.error ?? 'Could not start sign in.');
          return;
        }

        const credential = await startAuthentication(begun.options);
        const result = await finishSignIn(credential);
        if (result.error) {
          setError(result.error);
          return;
        }
        // So the account screen knows this device holds it.
        rememberPasskey(credential.id);

        goTo(next);
        return;
      }

      const begun = await beginSignUp(email);
      if (begun.error || !begun.options) {
        setError(begun.error ?? 'Could not start sign up.');
        return;
      }

      const credential = await startRegistration(begun.options);
      const result = await finishSignUp(credential, next, deviceName());
      if (result.error) {
        setError(result.error);
        return;
      }
      rememberPasskey(credential.id);

      if (result.signedIn) {
        goTo(next);
        return;
      }

      setSent(true);
    } catch (err) {
      if (wasCancelled(err)) {
        setError('The passkey prompt was cancelled.');
        return;
      }

      if (noPasskeyHere(err)) {
        setError('This device has no passkey for this app.');
        return;
      }

      console.error('Error completing the passkey ceremony:', err);
      setError('The passkey could not be used. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  if (sent) {
    return (
      <Text style={styles.sent}>
        Your passkey is registered. We sent a verification link to {email}. Open
        it on this device to confirm the address and sign in here.
      </Text>
    );
  }

  return (
    <View style={styles.form}>
      {mode === 'sign-up' ? (
        <View style={styles.field}>
          <Label nativeID={emailId}>Email</Label>
          <Input
            aria-labelledby={emailId}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            textContentType="username"
            returnKeyType="go"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => void handleSubmit()}
            editable={!isPending}
          />
        </View>
      ) : (
        <Text style={styles.sent}>
          Your device will offer the passkeys it holds for this app.
        </Text>
      )}

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Button
        title={
          mode === 'sign-in'
            ? isPending
              ? 'Waiting for your passkey…'
              : 'Sign in with a passkey'
            : isPending
              ? 'Creating your passkey…'
              : 'Create a passkey'
        }
        disabled={isPending || (mode === 'sign-up' && email === '')}
        onPress={() => void handleSubmit()}
      />

      <Button
        title={
          mode === 'sign-in' ? 'Create an account' : 'I already have an account'
        }
        variant="link"
        size="sm"
        disabled={isPending}
        onPress={switchMode}
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  switch: {
    alignSelf: 'flex-start',
  },
  sent: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
