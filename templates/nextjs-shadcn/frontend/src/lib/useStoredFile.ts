'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { nhost } from '@/lib/nhost/client';

/**
 * How a stored image is asked for over an authenticated fetch.
 *
 * Deliberately narrower than `ImageTransform`, which the `<img>` path uses:
 * there is no `auto` here. Storage resolves `f=auto` by looking for an exact
 * `image/avif` or `image/webp` entry in the request's `Accept` header. `fetch`
 * sends a wildcard `Accept`, which matches neither, so `auto` over this path
 * silently returns the original format: the megabyte an `<img>` would have
 * received as a kilobyte of WebP. Naming the format is what keeps the
 * re-encode, and `webp` is the one every browser this template targets
 * decodes.
 */
export type StoredFileTransform = {
  /** Maximum width in pixels, keeping the aspect ratio. */
  w?: number;
  /** Maximum height in pixels, keeping the aspect ratio. */
  h?: number;
  /** Quality, 1 to 100. */
  q?: number;
  f?: 'webp' | 'jpeg' | 'png' | 'same';
};

/**
 * The transform with every unset key dropped.
 *
 * `@nhost/nhost-js` 4.7.2 encodes query parameters with a bare `String(value)`
 * and no check for undefined, so handing it `{ h: undefined }` puts the literal
 * text `h=undefined` on the wire, and storage answers 400 - the image simply
 * never arrives and the avatar falls back to a blank square. Passing only the
 * keys that were actually asked for is what avoids that; it is also correct
 * against a version that does check.
 */
export function storedFileParams(
  transform: StoredFileTransform,
): StoredFileTransform {
  return Object.fromEntries(
    Object.entries(transform).filter(([, value]) => value !== undefined),
  );
}

/**
 * An object URL for a blob, revoked when the blob changes or the component
 * goes away.
 *
 * Held per component instance rather than next to the cached blob on purpose.
 * Two places drawing the same file share one download through the query cache,
 * but each owns its own URL, so one of them unmounting cannot revoke a URL the
 * other is still painting.
 */
function useObjectURL(blob: Blob | undefined): string | undefined {
  const [url, setURL] = useState<string>();

  useEffect(() => {
    if (!blob) {
      setURL(undefined);
      return;
    }

    const objectURL = URL.createObjectURL(blob);
    setURL(objectURL);

    return () => {
      URL.revokeObjectURL(objectURL);
    };
  }, [blob]);

  return url;
}

/**
 * A URL for a stored file that the signed-in viewer is allowed to read, for
 * use as an `<img src>`.
 *
 * The file is fetched with the session's `Authorization` header and handed to
 * the page as a blob URL, rather than pointed at with a presigned one. Both
 * solve the same problem - an `<img>` sends no Authorization header, so storage
 * answers it as `public`, and `public` may not read a private attachment, or
 * the avatar of an owner whose page is turned off - but the two approaches
 * behave very differently at the edge.
 *
 * A presigned URL is unique every time it is minted, so the CDN treats each one
 * as a resource it has never seen and every view is a miss. Fetching with the
 * header keeps one URL per file and size: the CDN caches the bytes and
 * revalidates against the caller's header, so the backend confirms the viewer
 * still has access without sending the image again. Privacy and the cache,
 * rather than one at the cost of the other.
 *
 * Public pages do not need this. They read with `fileURL`, which is already a
 * stable, cacheable URL for anyone.
 */
export function useStoredFileURL(
  fileId: string | null,
  transform: StoredFileTransform,
  options?: {
    /**
     * Distinguishes two different pictures stored under one id.
     *
     * The avatar function keeps a single file per user, keyed to their own id,
     * so replacing an avatar leaves the id alone and only the `updatedAt` the
     * function appends to the recorded URL changes. Without that value in the
     * key, a freshly uploaded picture would be served from the cached blob of
     * the one it replaced.
     */
    version?: string | null;
    enabled?: boolean;
  },
): string | undefined {
  const { w, h, q, f } = transform;
  const version = options?.version ?? null;
  const enabled = options?.enabled ?? true;

  const file = useQuery({
    // The transform belongs in the key: the same file at two sizes is two
    // different downloads, and storage caches them apart too.
    queryKey: ['stored-file', fileId, version, w, h, q, f],
    queryFn: async (): Promise<Blob> => {
      const { body } = await nhost.storage.getFile(
        fileId as string,
        storedFileParams({ w, h, q, f }),
      );

      return body;
    },
    enabled: enabled && Boolean(fileId),
    // Nothing here expires the way a signature does, so a file already fetched
    // is never refetched while the page lives. A replaced picture arrives under
    // a different key rather than through this one going stale.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  return useObjectURL(file.data);
}
