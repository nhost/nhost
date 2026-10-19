'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { updateDisplayName } from '@/app/account/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The display name as the profile shows it, editable in place.
 *
 * The name is already on the page, so a section of its own lower down was
 * showing it twice. Editing happens where it is read instead.
 */
export default function DisplayNameField({
  displayName,
}: {
  displayName: string;
}) {
  const router = useRouter();
  const nameId = useId();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const stopEditing = (): void => {
    setEditing(false);
    setError(undefined);
    // Back to what the page was given, so a cancelled edit leaves nothing
    // behind the next time this opens.
    setName(displayName);
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      const result = await updateDisplayName(name);
      if (result.error) {
        setError(result.error);
        return;
      }

      setEditing(false);
      // The name shown here comes from the auth service, so the page is
      // re-rendered rather than patched.
      router.refresh();
    } catch (err) {
      console.error('Error saving the display name:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  if (!editing) {
    return (
      // The button is quiet until it is wanted: hovering the row brings it
      // in, and so does tabbing to it, which is the part a bare hover rule
      // would leave unreachable.
      <div className="group flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-lg">{displayName}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      {/* The name is right above this when the form is closed, so the label
          is here for a screen reader rather than for the eye. */}
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
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={stopEditing}
        >
          Cancel
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
