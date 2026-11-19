import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import {
  type ComputedRef,
  computed,
  type MaybeRefOrGetter,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import {
  type AvatarWidth,
  avatarFileIdFrom,
  isAvatarType,
  isAvatarWidth,
} from '@/app/account/avatar';
import { nhost } from '@/lib/nhost/client';

// Storage reads the session from an Authorization header, which an <img>
// cannot send, so the file is fetched here and shown through an object URL.

// Quality for a resized image, fixed: one value per size means one cached
// variant per size.
const RESIZED_QUALITY = 80;

// `f=auto` picks AVIF, then WebP, then JPEG from the Accept header, and
// fetch() sends `*/*` unless told otherwise.
const ACCEPT = 'image/avif,image/webp,image/*';

type Entry = { src: Promise<string | undefined>; url?: string };

// One object URL per file and width, shared by every avatar on the page. They
// are revoked when the account's avatar changes or the session ends, not when
// one component unmounts while another still shows it.
const cache = new Map<string, Entry>();
let cachedFileId: string | undefined;
let watching = false;

function clear(): void {
  for (const entry of cache.values()) {
    if (entry.url) {
      URL.revokeObjectURL(entry.url);
    }
  }
  cache.clear();
  cachedFileId = undefined;
}

// Started on first use rather than on import, so a page without an avatar
// subscribes to nothing.
function watchSignOut(): void {
  if (watching) {
    return;
  }
  watching = true;

  nhost.sessionStorage.onChange((session) => {
    if (!session) {
      clear();
    }
  });
  window.addEventListener('storage', (event) => {
    if (
      (event.key === null || event.key === DEFAULT_SESSION_KEY) &&
      !event.newValue
    ) {
      clear();
    }
  });
}

async function fetchAvatar(
  fileId: string,
  width: AvatarWidth | undefined,
): Promise<Blob | undefined> {
  try {
    const { body, headers } = await nhost.storage.getFile(
      fileId,
      width === undefined
        ? undefined
        : { w: width, q: RESIZED_QUALITY, f: 'auto' },
      { headers: { Accept: ACCEPT } },
    );

    // Storage takes any file into the bucket and avatar_url can name any of
    // them, so the type is checked here rather than trusted.
    if (!isAvatarType(headers.get('content-type'))) {
      console.error('Refused an avatar that is not an image:', fileId);
      return undefined;
    }

    return body;
  } catch (err) {
    console.error('Could not load the avatar:', err);
    return undefined;
  }
}

function load(
  fileId: string,
  width: AvatarWidth | undefined,
): Promise<string | undefined> {
  watchSignOut();

  if (fileId !== cachedFileId) {
    clear();
    cachedFileId = fileId;
  }

  const key = `${fileId}:${width ?? ''}`;
  const cached = cache.get(key);
  if (cached) {
    return cached.src;
  }

  const entry: Entry = {
    src: fetchAvatar(fileId, width).then((blob) => {
      const current = cache.get(key) === entry;

      if (!blob || !current) {
        // A failure is not kept, so the next avatar to render tries again.
        if (current) {
          cache.delete(key);
        }
        return undefined;
      }

      entry.url = URL.createObjectURL(blob);
      return entry.url;
    }),
  };
  cache.set(key, entry);
  return entry.src;
}

/**
 * What an `<img>` can show for `avatarUrl`: an object URL for a file this app
 * uploaded, the URL itself for an absolute http(s) one such as gravatar's, and
 * nothing for anything else, such as a path, which would load this app's
 * index.html.
 */
export function useAvatarSrc(
  avatarUrl: MaybeRefOrGetter<string | undefined>,
  width?: MaybeRefOrGetter<AvatarWidth | undefined>,
): ComputedRef<string | undefined> {
  // Only a UUID and a width from the allowlist ever reach storage.
  const fileId = computed(() => avatarFileIdFrom(toValue(avatarUrl)));
  const key = computed(() => {
    const w = toValue(width);
    return fileId.value && (w === undefined || isAvatarWidth(w))
      ? `${fileId.value}:${w ?? ''}`
      : undefined;
  });
  const loaded = shallowRef<{ key: string; src?: string }>();

  watch(
    key,
    (current, _before, onCleanup) => {
      if (!current || !fileId.value) {
        return;
      }

      let live = true;
      onCleanup(() => {
        live = false;
      });
      void load(fileId.value, toValue(width)).then((src) => {
        if (live) {
          loaded.value = { key: current, src };
        }
      });
    },
    { immediate: true },
  );

  return computed(() => {
    if (!fileId.value) {
      const url = toValue(avatarUrl);
      return url && /^https?:\/\//i.test(url) ? url : undefined;
    }

    const current = loaded.value;
    return current && current.key === key.value ? current.src : undefined;
  });
}
