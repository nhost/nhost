'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AccountSection from '@/app/account/AccountSection';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/nhost/actions';

/**
 * Signing out everywhere, which is the one worth a section.
 *
 * Signing out of this browser alone is in the nav, on every page. Repeating
 * it here only made the visitor choose between two buttons that read alike.
 */
export default function SignOutCard() {
  const router = useRouter();

  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const handleSignOut = async (): Promise<void> => {
    setError(undefined);
    setPending(true);
    try {
      const result = await signOut({ all: true });
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
      setPending(false);
    }
  };

  return (
    <AccountSection
      title="Sessions"
      description="Revokes every session this account holds, here and anywhere else."
      // Beside the description rather than under it: it acts on the section
      // as a whole, and under the text it read as its next step.
      action={
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => void handleSignOut()}
        >
          {pending ? 'Signing out…' : 'Sign out of all devices'}
        </Button>
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
