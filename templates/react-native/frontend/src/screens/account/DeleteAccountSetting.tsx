import { DialogSetting } from '@/components/Setting';
import { goTo } from '@/lib/goTo';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { deleteAccount } from '@/screens/account/actions';
import ConfirmAction from '@/screens/account/ConfirmAction';

/** Closing the account for good. */
export default function DeleteAccountSetting() {
  const handleDelete = async (): Promise<string | undefined> => {
    try {
      const result = await deleteAccount();
      if (result.error) {
        return result.error;
      }

      // The account and its session are gone, so there is nothing here to
      // come back to.
      goTo('/');
      return undefined;
    } catch (err) {
      console.error('Error deleting the account:', err);
      return NETWORK_ERROR;
    }
  };

  return (
    <DialogSetting
      label="Account"
      value=""
      action="Delete account"
      destructive
      title="Delete account?"
      description="This removes your account, its sign-in methods and its avatar. It can't be undone."
    >
      <ConfirmAction
        typeToConfirm="delete"
        confirm="Delete account"
        pending="Deleting…"
        cancel="Keep account"
        destructive
        onConfirm={handleDelete}
      />
    </DialogSetting>
  );
}
