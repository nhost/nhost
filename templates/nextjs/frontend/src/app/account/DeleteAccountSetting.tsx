'use client';

import { useRouter } from 'next/navigation';
import { deleteAccount } from '@/app/account/actions';
import ConfirmAction from '@/app/account/ConfirmAction';
import { DialogSetting } from '@/components/Setting';

/**
 * Closing the account for good.
 *
 * The row only opens the question. Nothing here can be undone and there is
 * no confirmation email, so the button that acts waits for "delete" to be
 * typed, which a stray click or a habitual Enter cannot do.
 */
export default function DeleteAccountSetting() {
  const router = useRouter();

  const handleDelete = async (): Promise<string | undefined> => {
    try {
      const result = await deleteAccount();
      if (result.error) {
        return result.error;
      }

      // The account and its session are gone, so there is nothing here to
      // come back to.
      router.push('/');
      router.refresh();
      return undefined;
    } catch (err) {
      console.error('Error deleting the account:', err);
      return 'The request did not reach the server. Try again.';
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
