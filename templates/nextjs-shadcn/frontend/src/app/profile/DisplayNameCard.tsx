'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
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

export function DisplayNameCard({
  displayName,
}: {
  displayName?: string | null;
}) {
  const router = useRouter();
  const nameId = useId();

  const [name, setName] = useState(displayName ?? '');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setIsSaving(true);

    const result = await updateDisplayName(name);
    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display name</CardTitle>
        <CardDescription>
          Saved on your own row in <code>auth.users</code> through a GraphQL
          mutation the <code>user</code> role is permitted to run.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex items-end gap-2" onSubmit={handleSave}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada Lovelace"
              disabled={isSaving}
            />
          </div>
          <Button type="submit" disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </form>

        {error ? (
          <p className="mt-2 text-destructive text-sm">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
