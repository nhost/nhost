'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import AccountSection from '@/app/account/AccountSection';
import { updateDisplayName } from '@/app/account/actions';
import { Button } from '@/components/ui/button';
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
    <AccountSection
      title="Display name"
      description="How this account is shown to others."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {/* The section heading already names the field, so the label is here
            for a screen reader and the input keeps the button company on one
            line rather than leaving the row half empty. */}
        <Label htmlFor={nameId} className="sr-only">
          Display name
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={nameId}
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isPending}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
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
      </form>
    </AccountSection>
  );
}
