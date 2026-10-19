'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AccountSection from '@/app/account/AccountSection';
import { deleteAccount } from '@/app/account/actions';
import { Button } from '@/components/ui/button';

/**
 * Closing the account for good.
 *
 * Two presses, not one. Nothing here can be undone and the button sits a
 * short scroll under a row of ordinary settings, so the first press only
 * asks; the second is the one that acts, and it says what it is deleting.
 */
export default function DeleteAccountCard() {
  const router = useRouter();

  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await deleteAccount();
      if (result.error) {
        setError(result.error);
        return;
      }

      // The account and its session are gone, so there is nothing here to
      // come back to.
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error deleting the account:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AccountSection
      title="Delete account"
      description="Removes the account, its sign-in methods and its files, for good."
      // Beside the description, like the sign-out above it, so the two
      // sections at the foot of the card read the same way.
      action={
        asking ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAsking(true)}
          >
            Delete account
          </Button>
        )
      }
    >
      {asking ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/50 p-4">
          <p className="text-sm">
            Deleting the account signs you out everywhere and cannot be
            reversed. There is no confirmation email and nothing to restore it
            from.
          </p>
          {/* Right, where the button that opened this panel was, so the
              answer lands under the question rather than across from it.
              Keeping the account leads, which puts the irreversible one on
              the outside and the way out first for a keyboard. */}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setAsking(false);
                setError(undefined);
              }}
            >
              Keep my account
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => void handleDelete()}
            >
              {isPending ? 'Deleting…' : 'Delete it permanently'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </AccountSection>
  );
}
