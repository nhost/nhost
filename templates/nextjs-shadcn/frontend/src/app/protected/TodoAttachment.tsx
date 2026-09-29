'use client';

import { ImageUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { FileThumbnail } from '@/components/FileThumbnail';
import { RowPlaceholder } from '@/components/RowPlaceholder';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ROW_MEDIA,
  ROW_MEDIA_SLOT,
  ROW_PLACEHOLDER,
} from '@/components/WantSentence';
import { nhost } from '@/lib/nhost/client';

const BUCKET = 'todo-attachments';

/**
 * The photo on a todo, and the only way to change it.
 *
 * It is the media slot itself rather than a control living somewhere else on
 * the row: the picture is the thing being edited, so the pen belongs on the
 * picture. That also means a row has no separate "edit" mode to enter before
 * its photo can be touched - the slot is always live, whether or not there is
 * anything in it yet.
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
  index,
  alt,
  onChange,
  onError,
  disabled,
}: {
  fileId: string | null;
  /** Row position, which sets the phase of the placeholder hatch. */
  index: number;
  alt: string;
  onChange: (fileId: string | null) => Promise<void>;
  onError: (message: string | undefined) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);

  const busy = isBusy || disabled;

  // Upload, point the row at the new file, then drop the old one, awaiting
  // each step. If the row update rejects, the `deleteFile` call below never
  // runs, so a failure anywhere leaves an unreferenced file behind, which is
  // harmless, rather than a row pointing at a file that is already gone.
  const handlePick = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    onError(undefined);
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
      await onChange(uploaded);

      if (previous) {
        await nhost.storage.deleteFile(previous);
      }
    } catch (err) {
      onError(`Could not attach that photo: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!fileId) {
      return;
    }

    onError(undefined);
    setIsBusy(true);

    try {
      await onChange(null);
      await nhost.storage.deleteFile(fileId);
    } catch (err) {
      onError(`Could not remove that photo: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const pick = (): void => inputRef.current?.click();

  // The overlay that reveals on hover, shared by both states below.
  const overlay =
    'absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg opacity-0 outline-none transition-opacity focus-visible:opacity-100 hover:opacity-100 disabled:cursor-not-allowed data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100';

  return (
    <div className={`relative ${ROW_MEDIA_SLOT}`}>
      {fileId ? (
        <FileThumbnail fileId={fileId} alt={alt} className={ROW_MEDIA} />
      ) : (
        <div className={`${ROW_MEDIA} overflow-hidden`}>
          <RowPlaceholder index={index} className={ROW_PLACEHOLDER} />
        </div>
      )}

      {/* An empty slot has exactly one thing it can do, so it does it: a plus,
          and the file picker. A menu with a single item in it is a question
          with one answer. A slot with a picture in it has three, so that one
          gets the pen and the menu. */}
      {fileId ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            aria-label={`Change the photo on ${alt}`}
            className={`${overlay} bg-background/70 [@media(hover:none)]:bg-transparent`}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Pencil className="size-4" aria-hidden />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="min-w-40">
            <DropdownMenuItem onSelect={pick}>
              <ImageUp aria-hidden />
              Replace photo
            </DropdownMenuItem>

            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void handleRemove()}
            >
              <Trash2 aria-hidden />
              Remove photo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          aria-label={`Add a photo to ${alt}`}
          className={`${overlay} bg-background/50 text-muted-foreground [@media(hover:none)]:bg-transparent`}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-5" aria-hidden />
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
    </div>
  );
}
