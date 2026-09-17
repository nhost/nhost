'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteAccount } from '@/app/profile/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function DeleteAccountCard() {
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setError(undefined);
    setIsDeleting(true);

    const result = await deleteAccount();

    if (result.error) {
      setIsDeleting(false);
      setError(result.error);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Marks the account deleted and signs you out everywhere. Signing back
          in within 30 days offers to restore it; after that the data is up for
          permanent removal.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Yes, delete my account'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={isDeleting}
            >
              Keep it
            </Button>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(true)}
            >
              Delete account…
            </Button>
          </div>
        )}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
