// Where an uploaded avatar is served from.
const PREFIX = '/api/avatar/';

export const avatarUrlFor = (fileId: string): string => `${PREFIX}${fileId}`;

// Storage file ids are UUIDs.
const FILE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isFileId = (id: string): boolean => FILE_ID.test(id);

// The file id behind an avatar URL this app wrote, or undefined for anything
// else, such as the gravatar URL a fresh account starts with. avatar_url is the
// user's to set.
export const avatarFileIdFrom = (
  url: string | undefined,
): string | undefined => {
  const id = url?.startsWith(PREFIX) ? url.slice(PREFIX.length) : undefined;
  return id && isFileId(id) ? id : undefined;
};

// The largest avatar this app takes.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AVATAR_TOO_LARGE = 'That image is over 5 MB.';

// The types an avatar may be: raster images only.
export const AVATAR_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
];

// Takes a full content-type, so `image/png; charset=binary` is a PNG.
export const isAvatarType = (contentType: string | null): boolean =>
  AVATAR_TYPES.includes(
    (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '',
  );

/** The widths the route will ask storage to resize to, and no others. */
export const AVATAR_WIDTHS = [64, 192] as const;

export type AvatarWidth = (typeof AVATAR_WIDTHS)[number];

export const isAvatarWidth = (width: number): width is AvatarWidth =>
  (AVATAR_WIDTHS as readonly number[]).includes(width);

/**
 * The URL to render `avatarUrl` at, asking for `width` where that is ours to
 * ask.
 */
export const avatarSrc = (url: string, width: AvatarWidth): string =>
  avatarFileIdFrom(url) ? `${url}?w=${width}` : url;
