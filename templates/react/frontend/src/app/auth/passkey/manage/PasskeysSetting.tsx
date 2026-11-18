import { listPasskeys } from '@/app/auth/passkey/manage/actions';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys';
import { passkeyName } from '@/app/auth/passkey/manage/names';
import { DialogSetting } from '@/components/Setting';
import { useLoad } from '@/lib/useLoad';

// Read when the account page renders, not when the dialog opens: the names are
// the row's value, and adding or removing one refreshes the page, which reads
// them again.
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
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : loaded.error ? (
        <p role="alert" className="text-destructive text-sm">
          {loaded.error}
        </p>
      ) : (
        <ManagePasskeys keys={keys} />
      )}
    </DialogSetting>
  );
}
