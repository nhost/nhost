'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>
          Sign out here, or on every device this account is signed in on.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(pending)}
            onClick={() => void handleSignOut(false)}
          >
            {pending === 'here' ? 'Signing out…' : 'Sign out'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={Boolean(pending)}
            onClick={() => void handleSignOut(true)}
          >
            {pending === 'everywhere' ? 'Signing out…' : 'Sign out everywhere'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
