import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReplacePage } from '@/components/ReplacePageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { goTo } from '@/lib/goTo';
import { signOut } from '@/lib/nhost/actions';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { setNewPassword } from '@/screens/auth/password/actions';
import PasswordChanged from '@/screens/auth/password/PasswordChanged';
import PasswordRequirements from '@/screens/auth/password/PasswordRequirements';
import { meetsRequirements } from '@/screens/auth/password/requirements';
import { colors, fontSize } from '@/theme';

export default function ResetPasswordForm() {
  const replacePage = useReplacePage();
  const passwordId = useId();
  const confirmId = useId();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const canSave = !isSaving && meetsRequirements(password, confirm);

  const handleSubmit = async (): Promise<void> => {
    if (!canSave) {
      return;
    }
    setError(undefined);
    setIsSaving(true);
    try {
      const result = await setNewPassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }

      replacePage(<PasswordChanged />);
    } catch (err) {
      console.error('Error changing the password:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  // The way out without a new password. The guard keeps a reset link's
  // session on this screen until one is saved, so leaving means ending it.
  const handleCancel = async (): Promise<void> => {
    setError(undefined);
    setIsSaving(true);
    try {
      const result = await signOut();
      if (result.error) {
        setError(result.error);
        return;
      }

      goTo('/');
    } catch (err) {
      console.error('Error cancelling the reset:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Label nativeID={passwordId}>New password</Label>
        <Input
          aria-labelledby={passwordId}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          value={password}
          onChangeText={setPassword}
          editable={!isSaving}
        />
      </View>

      <View style={styles.field}>
        <Label nativeID={confirmId}>Confirm new password</Label>
        <Input
          aria-labelledby={confirmId}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          value={confirm}
          onChangeText={setConfirm}
          onSubmitEditing={() => void handleSubmit()}
          editable={!isSaving}
        />
      </View>

      <PasswordRequirements password={password} confirm={confirm} />

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Button
        title={isSaving ? 'Saving…' : 'Save password'}
        disabled={!canSave}
        onPress={() => void handleSubmit()}
      />

      <Button
        title="Cancel"
        variant="ghost"
        size="sm"
        disabled={isSaving}
        onPress={() => void handleCancel()}
        style={styles.cancel}
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
  cancel: {
    alignSelf: 'center',
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
