'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';
import { removeAvatar, uploadAvatar } from '@/app/profile/actions';
import { initial } from '@/components/UserMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

// Mirrors the server action's cap; checking here avoids an upload that would
// only be rejected on the other side.
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export function AvatarPicker({
  email,
  displayName,
  avatarUrl,
}: {
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isBusy = isUploading || isRemoving;

  const upload = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('The image is too large. Keep it under 4 MB.');
      return;
    }

    const formData = new FormData();
    formData.set('avatar', file);

    setError(undefined);
    setIsUploading(true);
    const result = await uploadAvatar(formData);
    setIsUploading(false);

    if (fileInput.current) {
      fileInput.current.value = '';
    }

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const handleRemove = async (): Promise<void> => {
    setError(undefined);
    setIsRemoving(true);
    const result = await removeAvatar();
    setIsRemoving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void upload(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    setIsDraggingOver(false);
    void upload(event.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        disabled={isBusy}
        aria-label="Change your avatar"
        className={`group relative cursor-pointer rounded-full outline-none ring-offset-4 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring ${
          isDraggingOver ? 'ring-2 ring-ring' : ''
        }`}
      >
        <Avatar className="size-20 border">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-3xl">
            {initial(displayName, email)}
          </AvatarFallback>
        </Avatar>

        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white transition-opacity ${
            isBusy || isDraggingOver
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isBusy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Camera className="size-5" aria-hidden />
          )}
        </span>
      </button>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
      />

      <p className="text-center text-muted-foreground text-xs">
        {isUploading ? 'Uploading…' : 'Click or drop an image'}
      </p>

      {/* Offered whenever there is an image to take away, which includes the
          one auth assigns on sign-up: removing it falls back to the initial
          rather than to someone else's default picture. */}
      {avatarUrl ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={isBusy}
          className="h-auto px-2 py-1 text-muted-foreground text-xs hover:text-foreground"
        >
          {isRemoving ? 'Removing…' : 'Remove image'}
        </Button>
      ) : null}

      {error ? (
        <p className="text-center text-destructive text-sm">{error}</p>
      ) : null}
    </div>
  );
}
