'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useRef, useState } from 'react';
import { uploadAvatar } from '@/app/account/actions';
import {
  AVATAR_TOO_LARGE,
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The upload control for the avatar, with no image of its own.
 *
 * ProfileSummary renders the current avatar and embeds this beneath it, so
 * the two sit in one card and the image is on the page once.
 */
export default function AvatarForm() {
  const router = useRouter();
  const fileId = useId();
  const form = useRef<HTMLFormElement>(null);

  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const file = formData.get('avatar');
    if (file instanceof File && file.size > MAX_AVATAR_BYTES) {
      setError(AVATAR_TOO_LARGE);
      return;
    }

    setIsPending(true);
    try {
      const result = await uploadAvatar(formData);
      if (result.error) {
        setError(result.error);
        return;
      }

      form.current?.reset();
      // The image above reads its URL from the auth service, so the page is
      // re-rendered rather than patched here.
      router.refresh();
    } catch (err) {
      console.error('Error uploading the avatar:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      ref={form}
      className="flex flex-col gap-2"
      onSubmit={(event) => void handleSubmit(event)}
    >
      {/* A file input labels itself with the file name, so the label is here
          for a screen reader rather than for the eye, and the control keeps
          to one line beside the button. */}
      <Label htmlFor={fileId} className="sr-only">
        New avatar image
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={fileId}
          name="avatar"
          type="file"
          accept={AVATAR_TYPES.join(',')}
          required
          disabled={isPending}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Uploading…' : 'Upload'}
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
