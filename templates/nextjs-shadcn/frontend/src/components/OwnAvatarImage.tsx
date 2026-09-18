'use client';

import { useQuery } from '@tanstack/react-query';
import { AvatarImage } from '@/components/ui/avatar';
import { nhost } from '@/lib/nhost/client';
import { isStoredAvatarURL, withTransform } from '@/lib/storage';

/**
 * The signed-in viewer's own avatar.
 *
 * It cannot be the plain file URL, for the same reason `FileThumbnail` cannot
 * use one: an `<img>` sends no Authorization header, so storage answers it as
 * the `public` role, and that role may only read an avatar whose owner has
 * published their profile. The plain URL therefore works for strangers on
 * `/u/<id>` and 404s for an unpublished owner on their own pages - the wrong
 * way round, and it reads as an upload that silently failed, because the picker
 * goes on offering "Remove image" for a picture nobody can see.
 *
 * A presigned URL is fetched with the session instead. Storage answers that as
 * `user`, where the rule is simply that the file is your own, so it resolves
 * whether or not the profile is published.
 *
 * Only a file this project stored is presigned. The picture auth assigns at
 * sign-up lives on another host, needs no signature, and is rendered as it is.
 */
export function OwnAvatarImage({
  userId,
  avatarUrl,
}: {
  userId: string;
  avatarUrl?: string | null;
}) {
  const isStored = isStoredAvatarURL(nhost.storage.baseURL, avatarUrl, userId);

  // Keyed by the stored URL rather than by the user alone: the avatar function
  // puts an `updatedAt` on it, so uploading a new picture changes the key and
  // the URL signed for the previous one is not served out of the cache.
  const presigned = useQuery({
    queryKey: ['own-avatar-url', userId, avatarUrl],
    queryFn: async () => {
      const { body } = await nhost.storage.getFilePresignedURL(userId);

      return body.url;
    },
    enabled: isStored,
    staleTime: 20_000,
    retry: false,
  });

  // Asked for at three times the size it is drawn at, the way `FileThumbnail`
  // does, so a dense screen stays sharp without pulling the whole 512px upload
  // down to paint it at 32. Only the presigned URL is transformed: the picture
  // auth assigns at sign-up is on another host, which has no such parameters.
  const src = isStored
    ? presigned.data &&
      withTransform(presigned.data, { w: 96, q: 80, f: 'auto' })
    : avatarUrl;

  // Nothing to draw until the signature arrives; the fallback initial shows
  // through in the meantime, which is what it is there for.
  if (!src) {
    return null;
  }

  return <AvatarImage src={src} alt="" />;
}
