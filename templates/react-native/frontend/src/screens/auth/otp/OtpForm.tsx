import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { goTo } from '@/lib/goTo';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { colors, fontSize, monospace } from '@/theme';
import { sendCode, verifyCode } from './actions';

type Step = 'email' | 'code';

// Where the code the code step waits for came from. Only the most recent one
// sent works, which matters once there has been more than one.
type Sent = 'now' | 'again' | 'earlier';

// The shape a browser's email field asks for; auth checks the rest.
const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+$/.test(value);

export default function OtpForm({ next }: { next: string }) {
  const emailId = useId();
  const codeId = useId();

  const [step, setStep] = useState<Step>('email');
  const [sent, setSent] = useState<Sent>('now');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const send = async (): Promise<void> => {
    if (isPending || !email) {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      const result = await sendCode(email);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setOtp('');
      setSent(step === 'code' ? 'again' : 'now');
      setStep('code');
    } catch (err) {
      console.error('Error sending the code:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const verify = async (): Promise<void> => {
    if (isPending || !otp) {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      const result = await verifyCode(email, otp);
      if (result?.error) {
        setError(result.error);
        return;
      }

      goTo(next);
    } catch (err) {
      console.error('Error verifying the code:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  // For a visitor who left the app after asking for a code: sending again
  // would replace the code their email holds.
  const haveCode = (): void => {
    if (!looksLikeEmail(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    setEmail(email.trim());
    setError(undefined);
    setSent('earlier');
    setStep('code');
  };

  const backToEmail = (): void => {
    setStep('email');
    setOtp('');
    setError(undefined);
  };

  const errorText = error ? (
    <Text role="alert" style={styles.error}>
      {error}
    </Text>
  ) : null;

  if (step === 'code') {
    return (
      <View style={styles.form}>
        <Text style={styles.sent}>
          {sent === 'now' && `We sent a code to ${email}.`}
          {sent === 'again' &&
            `We sent a new code to ${email}. Codes from earlier emails no longer work.`}
          {sent === 'earlier' &&
            `Enter the code from the most recent email we sent to ${email}.`}
        </Text>

        <View style={styles.field}>
          <Label nativeID={codeId}>Code</Label>
          <Input
            aria-labelledby={codeId}
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            returnKeyType="done"
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\s/g, ''))}
            onSubmitEditing={() => void verify()}
            editable={!isPending}
            style={styles.code}
          />
        </View>

        {errorText}

        <Button
          title={isPending ? 'Signing in…' : 'Sign in'}
          disabled={isPending || !otp}
          onPress={() => void verify()}
        />

        <View style={styles.links}>
          <Button
            title="Send a new code"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onPress={() => void send()}
          />
          <Button
            title="Use a different address"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onPress={backToEmail}
          />
        </View>
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
          textContentType="emailAddress"
          returnKeyType="send"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => void send()}
          editable={!isPending}
        />
      </View>

      {errorText}

      <Button
        title={isPending ? 'Sending…' : 'Send me a code'}
        disabled={isPending || !email}
        onPress={() => void send()}
      />

      <Button
        title="I already have a code"
        variant="ghost"
        size="sm"
        disabled={isPending || !email}
        onPress={haveCode}
        style={styles.haveCode}
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
  code: {
    fontFamily: monospace,
    letterSpacing: 4,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
  },
  haveCode: {
    alignSelf: 'center',
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
