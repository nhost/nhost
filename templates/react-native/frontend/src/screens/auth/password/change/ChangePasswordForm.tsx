import { useId, useRef, useState } from 'react';
import { StyleSheet, Text, type TextInputInstance, View } from 'react-native';
import { DialogClose, DialogFooter, useCloseDialog } from '@/components/Dialog';
import { useReplacePage } from '@/components/ReplacePageLayout';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { changePassword } from '@/screens/auth/password/change/actions';
import ChangedAndSignedOut from '@/screens/auth/password/change/ChangedAndSignedOut';
import PasswordRequirements from '@/screens/auth/password/PasswordRequirements';
import { meetsRequirements } from '@/screens/auth/password/requirements';
import { colors, fontSize, monospace } from '@/theme';

/**
 * `needsCode` is for an account with two-factor on: signing this device back
 * in with the new password takes a current code from the authenticator app too,
 * so the form asks for one alongside it.
 */
export default function ChangePasswordForm({
  needsCode = false,
}: {
  needsCode?: boolean;
}) {
  const replacePage = useReplacePage();
  const refresh = useRefresh();
  const toast = useToast();
  const close = useCloseDialog();
  const passwordId = useId();
  const confirmId = useId();
  const codeId = useId();
  const confirmRef = useRef<TextInputInstance>(null);
  const codeRef = useRef<TextInputInstance>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const ready =
    meetsRequirements(password, confirm) &&
    (!needsCode || /^\d{6}$/.test(code.trim()));

  const handleSubmit = async (): Promise<void> => {
    if (isPending || !ready) {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      const result = await changePassword(
        password,
        needsCode ? code.trim() : undefined,
      );
      if (result.error) {
        setError(result.error);
        return;
      }

      // Signed back in, so the screen stays: only the other devices lost
      // their session, and the session list under this is read again.
      if (result.signedIn) {
        close();
        toast('Password changed');
        refresh();
        return;
      }

      replacePage(<ChangedAndSignedOut />);
    } catch (err) {
      console.error('Error changing the password:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  return (
    // What changing it costs is the dialog's description, above this.
    <View style={styles.form}>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Label nativeID={passwordId}>New password</Label>
          <Input
            aria-labelledby={passwordId}
            label="New password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
            value={password}
            onChangeText={setPassword}
            editable={!isPending}
          />
        </View>

        <View style={styles.field}>
          <Label nativeID={confirmId}>Confirm new password</Label>
          <Input
            ref={confirmRef}
            aria-labelledby={confirmId}
            label="Confirm new password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType={needsCode ? 'next' : 'done'}
            submitBehavior={needsCode ? 'submit' : 'blurAndSubmit'}
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={() =>
              needsCode ? codeRef.current?.focus() : void handleSubmit()
            }
            editable={!isPending}
          />
        </View>

        <PasswordRequirements
          password={password}
          confirm={confirm}
          style={styles.rules}
        />

        {needsCode ? (
          <View style={styles.field}>
            <Label nativeID={codeId}>Authenticator code</Label>
            <Input
              ref={codeRef}
              aria-labelledby={codeId}
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="000000"
              maxLength={6}
              returnKeyType="done"
              value={code}
              onChangeText={setCode}
              onSubmitEditing={() => void handleSubmit()}
              editable={!isPending}
              style={styles.code}
            />
          </View>
        ) : null}
      </View>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <DialogFooter>
        <DialogClose disabled={isPending} />
        <Button
          title={isPending ? 'Changing…' : 'Change password'}
          size="sm"
          disabled={isPending || !ready}
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
  fields: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  rules: {
    alignItems: 'flex-start',
  },
  code: {
    fontFamily: monospace,
    letterSpacing: 4,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
