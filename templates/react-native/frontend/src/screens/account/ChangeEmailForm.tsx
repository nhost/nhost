import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { changeEmail, resendVerification } from '@/screens/account/actions';
import { colors, fontSize, radius } from '@/theme';

// What the dialog shows once a link has gone out: the next step is in the
// inbox.
type Sent = { kind: 'change'; to: string } | { kind: 'verification' };

/** Changing the address, and chasing the verification of the current one. */
export default function ChangeEmailForm({
  email,
  verified,
}: {
  email: string | undefined;
  verified: boolean;
}) {
  const emailId = useId();

  const [newEmail, setNewEmail] = useState('');
  const [sent, setSent] = useState<Sent | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const canSubmit = !isPending && newEmail.includes('@');

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      const result = await changeEmail(newEmail);
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent({ kind: 'change', to: newEmail });
      setNewEmail('');
    } catch (err) {
      console.error('Error starting the email change:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await resendVerification();
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent({ kind: 'verification' });
    } catch (err) {
      console.error('Error resending the verification email:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.form}>
        <Text role="status" style={styles.sent}>
          {sent.kind === 'change'
            ? `We sent a confirmation link to ${sent.to}. The address changes when you open it.`
            : `Another verification link is on its way to ${email}.`}
        </Text>
        <DialogFooter>
          <DialogClose title="Done" />
        </DialogFooter>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {email && !verified ? (
        <View style={styles.unverified}>
          <Text style={styles.unverifiedText}>
            This address has not been verified.
          </Text>
          <Button
            title="Resend verification"
            variant="outline"
            size="sm"
            disabled={isPending}
            onPress={() => void handleResend()}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Label nativeID={emailId}>New email</Label>
        <Input
          aria-labelledby={emailId}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          inputMode="email"
          textContentType="emailAddress"
          returnKeyType="send"
          placeholder="you@example.com"
          value={newEmail}
          onChangeText={setNewEmail}
          onSubmitEditing={() => void handleSubmit()}
          editable={!isPending}
        />
      </View>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <DialogFooter>
        <DialogClose disabled={isPending} />
        <Button
          title={isPending ? 'Sending…' : 'Send link'}
          size="sm"
          disabled={!canSubmit}
          onPress={() => void handleSubmit()}
        />
      </DialogFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  unverified: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  unverifiedText: {
    color: colors.destructive,
    fontSize: fontSize.sm,
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
