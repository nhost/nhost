'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { AvatarPicker } from '@/app/profile/AvatarPicker';
import { updateDisplayName } from '@/app/profile/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The email lives in its own card: it is the sign-in credential rather than a
// display detail, and its change flow is a conversation with the mailbox.
export function ProfileCard({
  userId,
  email,
  displayName,
  avatarUrl,
}: {
  userId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const nameId = useId();

  const [name, setName] = useState(displayName ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [isSavingName, setIsSavingName] = useState(false);

  const nameChanged = name.trim() !== (displayName ?? '').trim();

  const handleSaveName = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setNameError(undefined);
    setIsSavingName(true);

    const result = await updateDisplayName(name);
    setIsSavingName(false);

    if (result.error) {
      setNameError(result.error);
      return;
    }

    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          The avatar goes through a serverless function and storage. The name
          goes through auth and per-user GraphQL permissions.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <AvatarPicker
          userId={userId}
          email={email}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />

        {/* Centred against the whole avatar column, caption and all, rather
            than against the picture alone, which left the field high and a
            gap under it. */}
        <div className="flex flex-1 flex-col gap-5">
          <form className="flex items-end gap-2" onSubmit={handleSaveName}>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={nameId}>Display name</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                disabled={isSavingName}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={isSavingName || !nameChanged || !name.trim()}
            >
              {isSavingName ? 'Saving…' : 'Save'}
            </Button>
          </form>

          {nameError ? (
            <p className="text-destructive text-sm">{nameError}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
