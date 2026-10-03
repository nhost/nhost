'use client';

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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (): Promise<void> => {
    setError(undefined);
    setIsDeleting(true);
    try {
      const result = await deleteAccount();
      if (!result.success) {
        setError(
          result.error ?? 'The request did not reach the server. Try again.',
        );
        setIsDeleting(false);
        return;
      }

      if (result.error) {
        // The account is deleted and this device's session is already cleared;
        // stay put so this warning is visible instead of redirecting it away
        // unseen.
        setError(result.error);
        setIsDeleting(false);
        return;
      }

      // A full document load for the same reason signing out uses one: this has
      // just signed every device out, and nothing rendered against the old
      // session should survive in the client router's cache. Deliberately not
      // resetting isDeleting here: the button must stay disabled for the
      // window.location.replace unload, or it re-enables a destructive action
      // the page is about to leave anyway.
      window.location.replace('/');
    } catch (err) {
      console.error('Could not delete the account:', err);
      setError('The request did not reach the server. Try again.');
      setIsDeleting(false);
    }
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
              onClick={() => void handleDelete()}
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
