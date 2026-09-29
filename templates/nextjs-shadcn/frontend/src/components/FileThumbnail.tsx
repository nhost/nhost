'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useStoredFileURL } from '@/lib/useStoredFile';

/**
 * Over a photo the dialog's usual close button disappears into whatever it
 * lands on, so here it gets its own disc to sit on. Scoped to this dialog: on
 * the others it sits on a solid panel and is fine as it is.
 */
const closeOverPhoto = [
  '[&_[data-slot=dialog-close]]:top-3',
  '[&_[data-slot=dialog-close]]:right-3',
  '[&_[data-slot=dialog-close]]:rounded-full',
  '[&_[data-slot=dialog-close]]:border',
  '[&_[data-slot=dialog-close]]:bg-background',
  '[&_[data-slot=dialog-close]]:p-2',
  '[&_[data-slot=dialog-close]]:text-foreground',
  '[&_[data-slot=dialog-close]]:opacity-90',
  '[&_[data-slot=dialog-close]]:shadow-md',
  '[&_[data-slot=dialog-close]]:hover:opacity-100',
].join(' ');

/**
 * A stored image, shown to the person who owns it, and openable at full size.
 *
 * It cannot be the plain file URL, because an `<img>` sends no Authorization
 * header: storage answers it as the `public` role, and that role can only read
 * an attachment once its item is shared. The plain URL therefore works on the
 * public page and 404s here, on the owner's own private rows, which is the
 * wrong way round.
 *
 * So the bytes are fetched with the session and drawn from a blob URL. See
 * `useStoredFileURL` for why that rather than a presigned URL: the short answer
 * is that a presigned URL is unique per mint, so every view misses the CDN.
 *
 * The thumbnail and the full-size image are two separate fetches, because they
 * are two different resources at the edge - a 96px WebP is not a crop of the
 * full-resolution one. The full-size fetch is held back until the dialog opens,
 * so merely listing items never pulls whole photos down.
 */
export function FileThumbnail({
  fileId,
  alt,
  className,
}: {
  fileId: string;
  alt: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Asked for at three times the size it is drawn at, so it stays sharp on a
  // dense screen while still arriving as a kilobyte or two rather than as the
  // whole photo.
  const thumbnailURL = useStoredFileURL(fileId, { w: 96, q: 80, f: 'webp' });

  // Its own size, only bounded: no width is asked for, so storage sends the
  // full resolution, and `q`/`f` shave the bytes off the encoding rather than
  // off the picture.
  const fullURL = useStoredFileURL(
    fileId,
    { q: 85, f: 'webp' },
    { enabled: isOpen },
  );

  const thumbnail = (
    <Avatar className={className}>
      {thumbnailURL ? (
        <AvatarImage src={thumbnailURL} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback className="rounded-[inherit]" />
    </Avatar>
  );

  // Nothing to open until the thumbnail has arrived, and a button that does
  // nothing should not look like one.
  if (!thumbnailURL) {
    return thumbnail;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        aria-label={`Open ${alt}`}
        className="cursor-pointer rounded-[inherit] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {thumbnail}
      </DialogTrigger>

      {/* Sized to the image rather than to a fixed column, with no padding, so
          the photo is the panel instead of sitting in one. `overflow-hidden`
          is what clips it to the panel's own corners. */}
      <DialogContent
        className={`gap-0 overflow-hidden p-0 sm:w-fit sm:max-w-[90vw] ${closeOverPhoto}`}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {/* The thumbnail stands in until the full-size fetch lands, so opening
            the dialog shows the picture immediately rather than an empty panel
            that fills in. */}
        {/* biome-ignore lint/performance/noImgElement: next/image cannot optimise a blob: URL, whose bytes storage has already resized and re-encoded */}
        <img
          src={fullURL ?? thumbnailURL}
          alt={alt}
          className="block h-auto max-h-[85vh] w-auto max-w-full"
        />
      </DialogContent>
    </Dialog>
  );
}
