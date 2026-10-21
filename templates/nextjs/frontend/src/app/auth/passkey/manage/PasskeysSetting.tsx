import { listPasskeys } from '@/app/auth/passkey/manage/actions';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys';
import { ExpandableSetting } from '@/components/Setting';

// Read when the account page renders, not when the row is opened: the count
// is the row's value, and adding or removing one refreshes the page, which
// reads it again.
export default async function PasskeysSetting() {
  const { keys, error } = await listPasskeys();
  const count = keys?.length ?? 0;

  let value: string;
  if (error) {
    value = 'Could not load';
  } else if (count === 0) {
    value = 'None';
  } else {
    value = `${count} ${count === 1 ? 'passkey' : 'passkeys'}`;
  }

  return (
    <ExpandableSetting
      label="Passkeys"
      value={value}
      action={count === 0 ? 'Add passkey' : 'Manage'}
    >
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <ManagePasskeys keys={keys ?? []} />
      )}
    </ExpandableSetting>
  );
}
