'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type ReactNode, useRef, useState } from 'react';
import { removeAvatar, uploadAvatar } from '@/app/account/actions';
import {
  AVATAR_TOO_LARGE,
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
import { Button } from '@/components/ui/button';

/**
 * The controls for the avatar, wrapped around the image itself.
 *
 * The image is passed in rather than rendered here: it comes from the auth
 * service on the server, and this is a client component. What this adds is
 * the round + in its bottom corner, and a remove link underneath.
 *
 * No file name and no separate upload step. The file input is the only way
 * to open a file picker, so it stays in the DOM for a screen reader and the
 * round button clicks it; choosing a file is the whole gesture, so the
 * upload starts there rather than waiting for a second press.
 */
export default function AvatarForm({
  canRemove,
  children,
}: {
  canRemove: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(undefined);

    // Checked here so an oversized file is refused without being sent, and
    // again in the action for a caller that does not come through this.
    if (file.size > MAX_AVATAR_BYTES) {
      setError(AVATAR_TOO_LARGE);
      event.target.value = '';
      return;
    }

    setIsPending(true);
    try {
      const body = new FormData();
      body.append('avatar', file);
      const result = await uploadAvatar(body);

      if (result.error) {
        setError(result.error);
        return;
      }

      // The image above reads its URL from the auth service, so the page is
      // re-rendered rather than patched here.
      router.refresh();
    } catch (err) {
      console.error('Error uploading the avatar:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      // Cleared either way, so choosing the same file again still fires.
      event.target.value = '';
      setIsPending(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await removeAvatar();

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error('Error removing the avatar:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {children}
        <input
          ref={input}
          type="file"
          name="avatar"
          accept={AVATAR_TYPES.join(',')}
          className="sr-only"
          disabled={isPending}
          aria-label="New avatar image"
          onChange={(event) => void handleChange(event)}
        />
        {/* Sat on the image's bottom corner rather than under it, where a
            row of buttons competed with the name beside it. The ring is the
            card colour, so the button reads as cut out of the image. */}
        <Button
          type="button"
          size="icon"
          disabled={isPending}
          aria-label="Upload a new avatar"
          title="Upload a new avatar"
          className="absolute right-0 bottom-0 size-6 rounded-full ring-2 ring-card"
          onClick={() => input.current?.click()}
        >
          <span aria-hidden="true" className="text-sm leading-none">
            +
          </span>
        </Button>
      </div>

      {canRemove ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={isPending}
          className="h-auto p-0 text-muted-foreground text-xs"
          onClick={() => void handleRemove()}
        >
          Remove
        </Button>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
