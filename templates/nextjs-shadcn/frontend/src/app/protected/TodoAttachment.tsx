'use client';

import { ImageUp, Loader2, X } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { FileThumbnail } from '@/components/FileThumbnail';
import { Button } from '@/components/ui/button';
import { nhost } from '@/lib/nhost/client';

const BUCKET = 'todo-attachments';

/**
 * One photo on a todo.
 *
 * Unlike the avatar, this goes straight from the browser to the storage API
 * with the signed-in user's own token. No serverless function and no admin
 * secret: the `storage.files` insert permission for the `user` role is what
 * decides the upload is allowed, and it only allows this bucket. That is the
 * ordinary way to accept a file, and the avatar is the exception, because it
 * has to be resized somewhere the browser cannot skip.
 */
export function TodoAttachment({
  fileId,
  onChange,
  disabled,
}: {
  fileId: string | null;
  onChange: (fileId: string | null) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const busy = isBusy || disabled;

  // Upload, point the row at the new file, then drop the old one. In that
  // order a failure anywhere leaves an unreferenced file behind, which is
  // harmless, rather than a row pointing at a file that is already gone.
  const handlePick = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setError(undefined);
    setIsBusy(true);

    try {
      const { body } = await nhost.storage.uploadFiles({
        'bucket-id': BUCKET,
        'file[]': [file],
      });

      const uploaded = body.processedFiles?.[0]?.id;
      if (!uploaded) {
        throw new Error('storage returned no file');
      }

      const previous = fileId;
      onChange(uploaded);

      if (previous) {
        await nhost.storage.deleteFile(previous);
      }
    } catch (err) {
      setError(`Could not attach that photo: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!fileId) {
      return;
    }

    setError(undefined);
    setIsBusy(true);

    try {
      onChange(null);
      await nhost.storage.deleteFile(fileId);
    } catch (err) {
      setError(`Could not remove that photo: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {fileId ? (
          <FileThumbnail
            fileId={fileId}
            alt="The photo on this item"
            className="size-9 rounded-md border"
          />
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {isBusy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <ImageUp aria-hidden />
          )}
          {fileId ? 'Replace photo' : 'Add photo'}
        </Button>

        {fileId ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleRemove}
            disabled={busy}
            className="text-muted-foreground hover:text-destructive"
          >
            <X aria-hidden />
            <span className="sr-only">Remove the photo</span>
          </Button>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePick}
        />
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
