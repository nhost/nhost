'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AccountSection from '@/app/account/AccountSection';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/nhost/actions';

type Pending = 'here' | 'everywhere';

export default function SignOutCard() {
  const router = useRouter();

  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<Pending | undefined>();

  const handleSignOut = async (all: boolean): Promise<void> => {
    setError(undefined);
    setPending(all ? 'everywhere' : 'here');
    try {
      const result = await signOut({ all });
      if (result.error) {
        setError(result.error);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error signing out:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setPending(undefined);
    }
  };

  return (
    <AccountSection
      title="Sessions"
      description="Sign out of this browser, or of everywhere this account is signed in."
      // Beside the description rather than under it: these act on the
      // section as a whole, and under the text they read as its next step.
      action={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={Boolean(pending)}
            onClick={() => void handleSignOut(false)}
          >
            {pending === 'here' ? 'Signing out…' : 'This browser'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={Boolean(pending)}
            onClick={() => void handleSignOut(true)}
          >
            {pending === 'everywhere' ? 'Signing out…' : 'All devices'}
          </Button>
        </div>
      }
    >
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </AccountSection>
  );
}
