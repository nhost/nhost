'use client';

import { useState } from 'react';
import { syncRestoredSession } from '@/app/profile/actions';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Shown when the account is not marked for deletion but this browser's session
 * still says it is.
 *
 * The page cannot simply redirect to `/profile`: the proxy reads the mark from
 * the session, so it would send the visitor straight back here, and round it
 * goes until the access token finally expires. Nor can the page fix the
 * session itself - clearing it is a cookie write, which belongs in a server
 * action rather than in a Server Component's render. So the way out is a
 * button, the same shape `RestoreAccountCard` already uses.
 */
export function RestoredCard() {
  const [error, setError] = useState<string | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleContinue = async () => {
    setError(undefined);
    setIsSyncing(true);

    const result = await syncRestoredSession();

    if (result.error) {
      setIsSyncing(false);
      setError(result.error);
      return;
    }

    // A full document load, not a client navigation: the router's cache still
    // holds pages rendered while the account was marked, and replaying one of
    // those would redirect back here.
    window.location.replace('/profile');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>This account is no longer scheduled for deletion</CardTitle>
        <CardDescription>
          It was restored somewhere else, and this browser has not caught up
          yet. Continuing refreshes the session so the rest of the app opens
          normally again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleContinue} disabled={isSyncing}>
            {isSyncing ? 'Continuing…' : 'Continue'}
          </Button>
          <SignOutButton />
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
