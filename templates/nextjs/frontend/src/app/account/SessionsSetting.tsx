'use client';

import { useRouter } from 'next/navigation';
import ConfirmAction from '@/app/account/ConfirmAction';
import { DialogSetting } from '@/components/Setting';
import { signOut } from '@/lib/nhost/actions';

/**
 * Signing out everywhere, which is the one worth a row.
 *
 * Signing out of this browser alone is in the nav, on every page. Repeating
 * it here only made the visitor choose between two buttons that read alike.
 *
 * Asked first, because this reaches past the browser it is clicked in: every
 * other device signed in to the account is signed out with it, and nothing
 * warns them.
 */
export default function SessionsSetting() {
  const router = useRouter();

  const handleSignOut = async (): Promise<string | undefined> => {
    try {
      const result = await signOut({ all: true });
      if (result.error) {
        return result.error;
      }

      router.push('/');
      router.refresh();
      return undefined;
    } catch (err) {
      console.error('Error signing out:', err);
      return 'The request did not reach the server. Try again.';
    }
  };

  return (
    <DialogSetting
      label="Sessions"
      // Left out on a phone, where the button takes the row and the words
      // were cut to a letter.
      value={<span className="max-sm:hidden">Signed in on this device</span>}
      action="Sign out everywhere"
      title="Sign out everywhere?"
      description="Every device signed in to this account will be signed out, including this one."
    >
      <ConfirmAction
        confirm="Sign out everywhere"
        pending="Signing out…"
        onConfirm={handleSignOut}
      />
    </DialogSetting>
  );
}
