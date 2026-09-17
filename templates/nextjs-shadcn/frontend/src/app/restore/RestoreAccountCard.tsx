'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { restoreAccount } from '@/app/profile/actions';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function RestoreAccountCard({ purgeDate }: { purgeDate: string }) {
  const router = useRouter();

  const [error, setError] = useState<string | undefined>();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setError(undefined);
    setIsRestoring(true);

    const result = await restoreAccount();

    if (result.error) {
      setIsRestoring(false);
      setError(result.error);
      return;
    }

    router.push('/profile');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restore your account?</CardTitle>
        <CardDescription>
          Unless restored, the account and its data are up for permanent removal
          after {purgeDate}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleRestore} disabled={isRestoring}>
            {isRestoring ? 'Restoring…' : 'Restore my account'}
          </Button>
          <SignOutButton />
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
