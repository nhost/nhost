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

  const [asking, setAsking] = useState(false);
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
        asking ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAsking(true)}
          >
            Sign out of all devices
          </Button>
        )
      }
    >
      {/* Asked first, because this reaches past the browser it is clicked
          in: every other device signed in to the account is signed out with
          it, and nothing warns them. */}
      {asking ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm">
            Every device signed in to this account will be signed out, including
            this one.
          </p>
          {/* Right, where the button that opened this panel was, so the
              answer lands under the question rather than across from it.
              Cancel leads, which puts the one that acts on the outside and
              the one that backs out first for a keyboard. */}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setAsking(false);
                setError(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => void handleSignOut()}
            >
              {pending ? 'Signing out…' : 'Sign out everywhere'}
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
