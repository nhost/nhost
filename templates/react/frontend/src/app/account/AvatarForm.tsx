import { type ChangeEvent, type ReactNode, useRef, useState } from 'react';
import { removeAvatar, uploadAvatar } from '@/app/account/actions';
import {
  AVATAR_TOO_LARGE,
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
} from '@/app/account/avatar';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/** The controls for the avatar, wrapped around the image itself. */
export default function AvatarForm({
  canRemove,
  children,
}: {
  canRemove: boolean;
  children: ReactNode;
}) {
  const refresh = useRefresh();
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
      // loaded again rather than patched here.
      refresh();
    } catch (err) {
      console.error('Error uploading the avatar:', err);
      setError(NETWORK_ERROR);
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

      refresh();
    } catch (err) {
      console.error('Error removing the avatar:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {children}
        {isPending ? (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60"
          >
            <span
              aria-hidden="true"
              className="size-8 animate-spin rounded-full border-2 border-foreground/25 border-t-foreground"
            />
            <span className="sr-only">Updating the avatar</span>
          </div>
        ) : null}
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
        {/* Sat on the image's bottom corner rather than under it, where a row
            of buttons competed with the name beside it. */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={isPending}
          aria-label="Upload a new avatar"
          title="Change photo"
          className="absolute -right-0.5 -bottom-0.5 size-6.5 rounded-full ring-2 ring-card hover:bg-accent"
          onClick={() => input.current?.click()}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="size-3"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
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

      {/* Narrow and centred under the avatar, which is the column it is in
          now that the name sits beside it. */}
      {error ? (
        <p
          role="alert"
          className="max-w-36 text-center text-destructive text-xs"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
