import { listPasskeys } from '@/app/auth/passkey/manage/actions';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys';
import { passkeyName } from '@/app/auth/passkey/manage/names';
import { DialogSetting } from '@/components/Setting';

// Read when the account page renders, not when the dialog opens: the names are
// the row's value, and adding or removing one refreshes the page, which reads
// them again.
export default async function PasskeysSetting() {
  const { keys, error } = await listPasskeys();
  const count = keys?.length ?? 0;

  let value: string;
  if (error) {
    value = 'Could not load';
  } else if (count === 0) {
    value = 'None';
  } else {
    value = (keys ?? []).map(passkeyName).join(', ');
  }

  return (
    <DialogSetting
      label="Passkeys"
      value={value}
      action={count === 0 ? 'Add' : 'Manage'}
      title={count === 0 ? 'Add a passkey' : 'Passkeys'}
      description="Sign in with your fingerprint, face or device PIN."
    >
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <ManagePasskeys keys={keys ?? []} />
      )}
    </DialogSetting>
  );
}
