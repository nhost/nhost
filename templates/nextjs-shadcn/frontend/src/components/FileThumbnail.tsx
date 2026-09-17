'use client';

import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { nhost } from '@/lib/nhost/client';
import { withTransform } from '@/lib/storage';

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
 * It has to be a presigned URL rather than the plain file URL, because an
 * `<img>` sends no Authorization header: storage answers it as the `public`
 * role, and that role can only read an attachment once its item is shared. The
 * plain URL therefore works on the public page and 404s here, on the owner's
 * own private rows, which is the wrong way round.
 *
 * The bucket's `download_expiration` is short, so the URL is refetched rather
 * than cached for long. The image itself is already loaded by then; the expiry
 * only matters for a tab left open across a re-render.
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
  const url = useQuery({
    queryKey: ['file-url', fileId],
    queryFn: async () => {
      const { body } = await nhost.storage.getFilePresignedURL(fileId);

      return body.url;
    },
    staleTime: 20_000,
    retry: false,
  });

  // Asked for at three times the size it is drawn at, so it stays sharp on a
  // dense screen while still arriving as a kilobyte or two rather than as the
  // whole photo.
  const thumbnail = (
    <Avatar className={className}>
      {url.data ? (
        <AvatarImage
          src={withTransform(url.data, { w: 96, q: 80, f: 'auto' })}
          alt=""
          className="object-cover"
        />
      ) : null}
      <AvatarFallback className="rounded-[inherit]" />
    </Avatar>
  );

  // Nothing to open until the URL has arrived, and a button that does nothing
  // should not look like one.
  if (!url.data) {
    return thumbnail;
  }

  return (
    <Dialog>
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
        {/* Its own size, only bounded: no width is asked for, so storage sends
            the full resolution, and `q`/`f` shave the bytes off the encoding
            rather than off the picture. */}
        {/* biome-ignore lint/performance/noImgElement: next/image would need `images.remotePatterns` for a storage host that is only known from the build-time env pair, and there is nothing for it to optimise on a URL that expires in seconds */}
        <img
          src={withTransform(url.data, { q: 85, f: 'auto' })}
          alt={alt}
          className="block h-auto max-h-[85vh] w-auto max-w-full"
        />
      </DialogContent>
    </Dialog>
  );
}
