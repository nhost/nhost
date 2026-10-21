'use client';

import { useRouter } from 'next/navigation';
import { deleteAccount } from '@/app/account/actions';
import ConfirmInPlace from '@/app/account/ConfirmInPlace';

/**
 * Closing the account for good.
 *
 * Two presses, not one. Nothing here can be undone and the button sits a
 * short scroll under a row of ordinary settings, so the first press only
 * asks; the second is the one that acts, and it says what it is deleting.
 */
export default function DeleteAccountCard() {
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
    <ConfirmInPlace
      title="Delete account"
      description="Removes the account, its sign-in methods and its avatar, for good."
      warning={
        <span className="text-destructive">
          This cannot be undone. There is no confirmation email and nothing to
          restore the account from.
        </span>
      }
      start="Delete account"
      confirm="Delete it permanently"
      pending="Deleting…"
      cancel="Keep my account"
      destructive
      onConfirm={handleDelete}
    />
  );
}
