// Where an uploaded avatar is served from. The file itself is private in
// storage and read with the session token by the route handler at this path,
// so `avatar_url` on the account points here rather than at storage.
const PREFIX = '/api/avatar/';

export const avatarUrlFor = (fileId: string): string => `${PREFIX}${fileId}`;

// Storage file ids are UUIDs. An id goes into a storage path with the
// visitor's token, so anything else, such as `..`, is refused rather than
// sent.
const FILE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isFileId = (id: string): boolean => FILE_ID.test(id);

// The file id behind an avatar URL this app wrote, or undefined for anything
// else, such as the gravatar URL a fresh account starts with. avatar_url is
// the user's to set, so a URL under this prefix is not trusted to name a file.
export const avatarFileIdFrom = (
  url: string | undefined,
): string | undefined => {
  const id = url?.startsWith(PREFIX) ? url.slice(PREFIX.length) : undefined;
  return id && isFileId(id) ? id : undefined;
};

// The largest avatar this app takes. AvatarForm checks it before sending and
// uploadAvatar checks it again for a caller that skips the form; the server
// action body limit in next.config.ts sits just above it, so a file over this
// gets this message rather than a 413 from Next.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AVATAR_TOO_LARGE = 'That image is over 5 MB.';

// The types an avatar may be: raster images only. SVG is left out because it
// can carry script, and the route handler serves the file on this app's
// origin. The form offers these, uploadAvatar takes only these, and the route
// handler serves only these, since a file can reach storage without the form.
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

/**
 * The widths the route will ask storage to resize to, and no others.
 *
 * Storage resizes on the way out, so a 5 MB photo does not have to cross the
 * wire to fill a 96px circle. It takes any `w` it is given, which is exactly
 * why this list is closed: an open one would let anyone make storage render
 * every size of every avatar they can see, and fill a cache with the
 * results, on their own say-so.
 *
 * Two entries because the template draws an avatar at two sizes, each at
 * twice its CSS pixels so it stays sharp on a dense screen: 32px in the nav,
 * 96px on the profile. A new size on a page means a new entry here.
 */
export const AVATAR_WIDTHS = [64, 192] as const;

export type AvatarWidth = (typeof AVATAR_WIDTHS)[number];

export const isAvatarWidth = (width: number): width is AvatarWidth =>
  (AVATAR_WIDTHS as readonly number[]).includes(width);

/**
 * The URL to render `avatarUrl` at, asking for `width` where that is ours to
 * ask.
 *
 * Only a URL this app wrote takes the parameter. `avatar_url` is the user's
 * to set and starts as a gravatar URL, which has its own sizing scheme and
 * would not understand this one.
 */
export const avatarSrc = (url: string, width: AvatarWidth): string =>
  avatarFileIdFrom(url) ? `${url}?w=${width}` : url;
