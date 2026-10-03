'use client';

import { AvatarImage } from '@/components/ui/avatar';
import { nhost } from '@/lib/nhost/client';
import { isStoredAvatarURL } from '@/lib/storage';
import { useStoredFileURL } from '@/lib/useStoredFile';

/**
 * The signed-in viewer's own avatar.
 *
 * It cannot be the plain file URL, for the same reason `FileThumbnail` cannot
 * use one: an `<img>` sends no Authorization header, so storage answers it as
 * the `public` role, and that role may only read an avatar whose owner leaves
 * their page on. The plain URL therefore 404s for an owner who has turned
 * their page off, on their own pages, while still working for strangers on
 * `/u/<id>` - the wrong way round, and it reads as an upload that silently
 * failed, because the picker goes on offering "Remove image" for a picture
 * nobody can see.
 *
 * The file is fetched with the session instead and drawn from a blob URL.
 * Storage answers that as `user`, where the rule is simply that the file is
 * your own, so it resolves whether the page is on or off - and unlike a
 * presigned URL it stays one cacheable URL per size at the edge. See
 * `useStoredFileURL`.
 *
 * Nothing is drawn unless this project stored it. The picture auth assigns at
 * sign-up is a Gravatar URL built from an md5 of the email, requested with
 * `d=blank` - and for the overwhelming majority of addresses, which have no
 * Gravatar, that returns a transparent 138-byte PNG with a 200. Rendering it
 * "worked", so the fallback initial never got its turn and every new account
 * showed an empty circle where its letter should be.
 *
 * Leaving it out is also one fewer request to a third party carrying a hash of
 * the user's email on every page that draws an avatar.
 */
export function OwnAvatarImage({
  userId,
  avatarUrl,
  size = 32,
}: {
  userId: string;
  avatarUrl?: string | null;
  /** CSS pixel size of the surrounding `Avatar`; keep it in sync with its `size-*` class. */
  size?: number;
}) {
  const isStored = isStoredAvatarURL(nhost.storage.baseURL, avatarUrl, userId);

  // Asked for at three times the size it is drawn at, the way `FileThumbnail`
  // does, so a dense screen stays sharp without pulling the whole 512px upload
  // down to paint it small.
  //
  // The avatar function stores one file per user under their own id, so the
  // recorded URL is what distinguishes a new picture from the one it replaced;
  // passing it as the version is what stops the old blob being reused.
  const storedURL = useStoredFileURL(
    isStored ? userId : null,
    { w: size * 3, q: 80, f: 'webp' },
    { version: avatarUrl },
  );

  // Nothing to draw until the bytes arrive, and nothing at all for an account
  // that never uploaded one; the fallback initial shows through in both cases,
  // which is what it is there for.
  if (!isStored || !storedURL) {
    return null;
  }

  return <AvatarImage src={storedURL} alt="" />;
}
