import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { nhost } from '@/lib/nhost/client';
import {
  type AvatarWidth,
  avatarFileIdFrom,
  isAvatarWidth,
} from '@/screens/account/avatar';

// Quality for a resized image, fixed: one value per size means one cached
// variant per size.
const RESIZED_QUALITY = 80;

// `f=auto` picks AVIF, then WebP, then JPEG from the Accept header; expo-image
// decodes all three.
const ACCEPT = 'image/avif,image/webp,image/*';

/** What an expo-image `source` needs to show an avatar. */
export type AvatarSource = { uri: string; headers?: Record<string, string> };

let watching = false;

// Storage images are cached in memory only, and dropped at sign-out so the
// next account on this device never paints the last one's.
function watchSignOut(): void {
  if (watching) {
    return;
  }
  watching = true;

  nhost.sessionStorage.onChange((session) => {
    if (!session) {
      void Image.clearMemoryCache();
    }
  });
}

const fileUrl = (fileId: string, width: AvatarWidth | undefined): string =>
  width === undefined
    ? `${nhost.storage.baseURL}/files/${fileId}`
    : `${nhost.storage.baseURL}/files/${fileId}?w=${width}&q=${RESIZED_QUALITY}&f=auto`;

async function storageSource(
  fileId: string,
  width: AvatarWidth | undefined,
): Promise<AvatarSource | undefined> {
  try {
    // Storage reads the session from the Authorization header, which the
    // native image loader sends from `headers`.
    const session = await nhost.refreshSession(60);

    if (!session) {
      return undefined;
    }

    return {
      uri: fileUrl(fileId, width),
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: ACCEPT,
      },
    };
  } catch (err) {
    console.error('Could not load the avatar:', err);
    return undefined;
  }
}

/**
 * What an expo-image can show for `avatarUrl`: the storage file with this
 * session's token for a file this app uploaded, the URL itself for an absolute
 * http(s) one such as gravatar's, and nothing for anything else, such as a
 * path, which names nothing on a device.
 */
export function useAvatarSrc(
  avatarUrl: string | undefined,
  width?: AvatarWidth,
): AvatarSource | undefined {
  // Only a UUID and a width from the allowlist ever reach storage.
  const fileId = avatarFileIdFrom(avatarUrl);
  const key =
    fileId && (width === undefined || isAvatarWidth(width))
      ? `${fileId}:${width ?? ''}`
      : undefined;
  const [loaded, setLoaded] = useState<{
    key: string;
    source?: AvatarSource;
  }>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key names both the file and the width
  useEffect(() => {
    if (!key || !fileId) {
      return;
    }

    watchSignOut();
    let current = true;
    void storageSource(fileId, width).then((source) => {
      if (current) {
        setLoaded({ key, source });
      }
    });
    return () => {
      current = false;
    };
  }, [key]);

  if (!fileId) {
    return avatarUrl && /^https?:\/\//i.test(avatarUrl)
      ? { uri: avatarUrl }
      : undefined;
  }

  return loaded && loaded.key === key ? loaded.source : undefined;
}
