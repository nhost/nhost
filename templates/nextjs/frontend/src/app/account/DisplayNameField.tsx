'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { updateDisplayName } from '@/app/account/actions';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/**
 * The display name as the profile shows it, editable in place.
 *
 * The one setting not behind a dialog: it is a single field, and the name it
 * changes is right there, so editing happens where it is read.
 */
export default function DisplayNameField({
  displayName,
}: {
  displayName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const nameId = useId();
  const input = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (editing) {
      input.current?.select();
    }
  }, [editing]);

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
      toast('Name saved');
      // The name shown here comes from the auth service, so the page is
      // re-rendered rather than patched.
      router.refresh();
    } catch (err) {
      console.error('Error saving the display name:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  if (!editing) {
    return (
      // Wraps rather than truncates: the name is what the card is for. It is
      // often the address, which has no spaces, so it may break anywhere.
      // Inline, so the pencil follows the last word rather than the edge.
      <p className="min-w-0 font-semibold text-xl leading-tight [overflow-wrap:anywhere]">
        {displayName}
        {/* Always shown rather than on hover: a phone has no hover, and a
            pencil is small enough not to crowd the name. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Edit name"
          title="Edit name"
          className="-my-1 ml-1 size-7 align-middle text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </Button>
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={handleSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isPending) {
          stopEditing();
        }
      }}
    >
      {/* The name is right here when the form is closed, so the label is
          for a screen reader rather than for the eye. */}
      <Label htmlFor={nameId} className="sr-only">
        Display name
      </Label>
      <div className="flex items-center gap-2">
        <Input
          ref={input}
          id={nameId}
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
          // h-8 to match the two small buttons beside it.
          className="h-8 min-w-0 flex-1"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="outline"
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
