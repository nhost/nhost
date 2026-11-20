// What an uploaded avatar's URL starts with. Nothing serves this path: it is
// the format the web templates write, so every template reads the same backend.
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

// The largest avatar this app takes. The upload goes straight to storage, so
// this is the app's own limit, the same as the web templates'.
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export const AVATAR_TOO_LARGE = 'That image is over 4 MB.';

export const AVATAR_NOT_AN_IMAGE = 'Use a PNG, JPEG, WebP or AVIF image.';

// The types an avatar may be: raster images storage can resize.
export const AVATAR_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
];

// Takes a full content-type, so `image/png; charset=binary` is a PNG.
export const isAvatarType = (contentType: string | null): boolean =>
  AVATAR_TYPES.includes(
    (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '',
  );

const TYPE_BY_EXTENSION = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
]);

/** The avatar type a file name's extension names, or `''` for any other. */
export const avatarTypeFromName = (name: string): string =>
  TYPE_BY_EXTENSION.get(/\.([^./]+)$/.exec(name)?.[1]?.toLowerCase() ?? '') ??
  '';

/** A picked image, as the upload sends it. */
export type AvatarFile = {
  uri: string;
  name: string;
  type: string;
  size: number;
};

/** The widths the app will ask storage to resize to, and no others. */
const AVATAR_WIDTHS = [64, 192] as const;

export type AvatarWidth = (typeof AVATAR_WIDTHS)[number];

export const isAvatarWidth = (width: number): width is AvatarWidth =>
  (AVATAR_WIDTHS as readonly number[]).includes(width);
