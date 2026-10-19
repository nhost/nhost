'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, useRef, useState } from 'react';
import { removeAvatar, uploadAvatar } from '@/app/account/actions';
import {
  AVATAR_TOO_LARGE,
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
import { Button } from '@/components/ui/button';

/**
 * The two buttons under the avatar: one to put a new image up, one to take
 * the current one down.
 *
 * No file name and no separate upload step. The file input is the only way
 * to open a file picker, so it stays in the DOM for a screen reader and the
 * visible button clicks it; choosing a file is the whole gesture, so the
 * upload starts there rather than waiting for a second press.
 *
 * ProfileSummary renders the image this sits beneath.
 */
export default function AvatarForm({ canRemove }: { canRemove: boolean }) {
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
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
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={isPending}
          aria-label="Upload a new avatar"
          title="Upload a new avatar"
          onClick={() => input.current?.click()}
        >
          <span aria-hidden="true">+</span>
        </Button>
        {canRemove ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={isPending}
            aria-label="Remove the avatar"
            title="Remove the avatar"
            onClick={() => void handleRemove()}
          >
            <span aria-hidden="true">×</span>
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
