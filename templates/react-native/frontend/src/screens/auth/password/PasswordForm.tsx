import { router } from 'expo-router';
import { useId, useRef, useState } from 'react';
import { StyleSheet, Text, type TextInputInstance, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { goTo } from '@/lib/goTo';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import {
  requestPasswordReset,
  signIn,
  signUp,
  verifyMfa,
} from '@/screens/auth/password/actions';
import PasswordRequirements from '@/screens/auth/password/PasswordRequirements';
import { meetsRequirements } from '@/screens/auth/password/requirements';
import { DEFAULT_DESTINATION } from '@/screens/signin/destination';
import { DEFAULT_INTENT, type Intent } from '@/screens/signin/intent';
import { colors, fontSize, monospace } from '@/theme';

// What the form shows once a request has gone out and there is nothing more
// to type: the next step happens in the visitor's inbox.
type Sent = 'verification' | 'reset';

export default function PasswordForm({
  next,
  intent,
}: {
  next: string;
  intent: Intent;
}) {
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const passwordRef = useRef<TextInputInstance>(null);

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so a
  // sign-in form would be a dead end.
  const [mode, setMode] = useState<Intent>(intent);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<Sent | undefined>();
  // Set when the password was right but the account has two-factor on: the
  // backend wants a code from the authenticator app before it issues a session.
  const [mfaTicket, setMfaTicket] = useState<string | undefined>();
  // Auth spends the ticket on every attempt, right or wrong, so a retry signs
  // in again with the same password for a fresh one.
  const [ticketSpent, setTicketSpent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const canSubmit =
    !isPending &&
    email !== '' &&
    password !== '' &&
    (mode === 'sign-in' || meetsRequirements(password));

  const finishSignIn = (): void => {
    goTo(next);
  };

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
    if (!canSubmit) {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      if (mode === 'sign-in') {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
          return;
        }

        if (result.mfaTicket) {
          setMfaTicket(result.mfaTicket);
          return;
        }

        finishSignIn();
        return;
      }

      const result = await signUp(email, password, next);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.signedIn) {
        finishSignIn();
        return;
      }

      setSent('verification');
    } catch (err) {
      console.error('Error submitting the form:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyCode = async (): Promise<void> => {
    if (isPending || code.trim() === '') {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      let ticket = mfaTicket;
      if (ticketSpent) {
        const fresh = await signIn(email, password);
        if (fresh.error) {
          setError(fresh.error);
          return;
        }

        // Two-factor was turned off in the meantime: the password alone was
        // enough.
        if (!fresh.mfaTicket) {
          finishSignIn();
          return;
        }

        ticket = fresh.mfaTicket;
        setMfaTicket(ticket);
        setTicketSpent(false);
      }

      const result = await verifyMfa(ticket ?? '', code.trim());
      if (result.error) {
        setTicketSpent(true);
        setError(result.error);
        return;
      }

      finishSignIn();
    } catch (err) {
      console.error('Error verifying the code:', err);
      setTicketSpent(true);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  // Keeps the email: going back is usually for the same account, with the
  // ticket lapsed or the authenticator not to hand.
  const startOver = (): void => {
    setMfaTicket(undefined);
    setTicketSpent(false);
    setCode('');
    setPassword('');
    setError(undefined);
  };

  const handleForgotPassword = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent('reset');
    } catch (err) {
      console.error('Error requesting the reset link:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const errorText = error ? (
    <Text role="alert" style={styles.error}>
      {error}
    </Text>
  ) : null;

  if (sent === 'verification') {
    return (
      <Text style={styles.sent}>
        We sent a verification link to {email}. Open it on this device to
        confirm the address and sign in here.
      </Text>
    );
  }

  if (sent === 'reset') {
    return (
      <Text style={styles.sent}>
        If that address has an account, a reset link is on its way. Open it on
        this device.
      </Text>
    );
  }

  if (mfaTicket) {
    return (
      <View style={styles.form}>
        <View style={styles.field}>
          <Label nativeID={codeId}>Authenticator code</Label>
          <Input
            aria-labelledby={codeId}
            label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            returnKeyType="done"
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => void handleVerifyCode()}
            editable={!isPending}
            style={styles.code}
          />
        </View>

        {errorText}

        <Button
          title={isPending ? 'Verifying…' : 'Verify'}
          disabled={isPending || code.trim() === ''}
          onPress={() => void handleVerifyCode()}
        />

        <Button
          title="Start over"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onPress={startOver}
          style={styles.startOver}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Label nativeID={emailId}>Email</Label>
        <Input
          aria-labelledby={emailId}
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          inputMode="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          editable={!isPending}
        />
      </View>

      <View style={styles.field}>
        <Label nativeID={passwordId}>Password</Label>
        <Input
          ref={passwordRef}
          aria-labelledby={passwordId}
          label="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={
            mode === 'sign-in' ? 'current-password' : 'new-password'
          }
          textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
          returnKeyType="go"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void handleSubmit()}
          editable={!isPending}
        />
        {/* Only while signing up. Signing in, the password already exists,
            and whether it would pass today's rules is not the question. */}
        {mode === 'sign-up' ? (
          <PasswordRequirements password={password} />
        ) : null}
      </View>

      {errorText}

      <Button
        title={
          mode === 'sign-in'
            ? isPending
              ? 'Signing in…'
              : 'Sign in'
            : isPending
              ? 'Signing up…'
              : 'Sign up'
        }
        disabled={!canSubmit}
        onPress={() => void handleSubmit()}
      />

      <View style={styles.links}>
        <Button
          title={
            mode === 'sign-in'
              ? 'Create an account'
              : 'I already have an account'
          }
          variant="link"
          size="sm"
          disabled={isPending}
          onPress={switchMode}
        />
        {mode === 'sign-in' ? (
          <Button
            title="Forgot your password?"
            variant="link"
            size="sm"
            disabled={isPending || !email}
            onPress={() => void handleForgotPassword()}
          />
        ) : null}
      </View>
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
  code: {
    fontFamily: monospace,
    letterSpacing: 4,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 16,
  },
  startOver: {
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
