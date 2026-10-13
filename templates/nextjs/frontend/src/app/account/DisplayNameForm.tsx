'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { updateDisplayName } from '@/app/account/actions';
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

export default function DisplayNameForm({
  displayName,
}: {
  displayName: string;
}) {
  const router = useRouter();
  const nameId = useId();

  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    setIsPending(true);
    try {
      const result = await updateDisplayName(name);
      if (result.error) {
        setError(result.error);
        return;
      }

      setSaved(true);
      // The summary above reads the name from the auth service, so the page
      // is re-rendered rather than patched here.
      router.refresh();
    } catch (err) {
      console.error('Error saving the display name:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display name</CardTitle>
        <CardDescription>How this account is shown to others.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isPending}
            />
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          {saved ? (
            <p role="status" className="text-muted-foreground text-sm">
              Saved.
            </p>
          ) : null}

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
