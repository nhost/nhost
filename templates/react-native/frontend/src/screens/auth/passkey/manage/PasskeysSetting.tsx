import { StyleSheet, Text } from 'react-native';
import { DialogSetting } from '@/components/Setting';
import { useLoad } from '@/lib/useLoad';
import { listPasskeys } from '@/screens/auth/passkey/manage/actions';
import ManagePasskeys from '@/screens/auth/passkey/manage/ManagePasskeys';
import { passkeyName } from '@/screens/auth/passkey/manage/names';
import { colors, fontSize } from '@/theme';

// Read when the account screen renders, not when the dialog opens: the names
// are the row's value, and adding or removing one refreshes the screen, which
// reads them again.
export default function PasskeysSetting() {
  const loaded = useLoad(listPasskeys);
  const keys = loaded?.keys ?? [];
  const empty = loaded !== undefined && keys.length === 0;

  let value: string;
  if (!loaded) {
    value = 'Loading…';
  } else if (loaded.error) {
    value = 'Could not load';
  } else if (empty) {
    value = 'None';
  } else {
    value = keys.map(passkeyName).join(', ');
  }

  return (
    <DialogSetting
      label="Passkeys"
      value={value}
      action={empty ? 'Add' : 'Manage'}
      title={empty ? 'Add a passkey' : 'Passkeys'}
      description="Sign in with your fingerprint, face or device PIN."
    >
      {!loaded ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : loaded.error ? (
        <Text role="alert" style={styles.error}>
          {loaded.error}
        </Text>
      ) : (
        <ManagePasskeys keys={keys} />
      )}
    </DialogSetting>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
