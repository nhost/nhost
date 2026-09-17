import type { NhostClient } from '@nhost/nhost-js';

/**
 * Storage resizes and re-encodes images on the way out, so the original is the
 * only copy ever stored and every size is a query string away.
 *
 * `f: 'auto'` negotiates the format against the browser's Accept header, which
 * is usually how the bytes come down: a photo asked for at thumbnail width
 * arrives as a kilobyte of WebP instead of the megabyte that was uploaded.
 * That is the reason attachments do not need a function to shrink them first,
 * the way the avatar does.
 */
export type ImageTransform = {
  /** Maximum width in pixels, keeping the aspect ratio. */
  w?: number;
  /** Quality, 1 to 100. Only affects JPEG, WebP, AVIF and HEIC. */
  q?: number;
  f?: 'auto' | 'same' | 'jpeg' | 'webp' | 'png' | 'avif' | 'heic';
};

/**
 * Appends transform parameters, keeping whatever query string is already
 * there. A presigned URL carries its signature that way, and the signature
 * does not cover these, so a private image can be resized the same as a public
 * one.
 */
export const withTransform = (
  url: string,
  transform: ImageTransform,
): string => {
  const query = Object.entries(transform)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  if (!query) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
};

/**
 * URL a stored file is served from.
 *
 * Not a presigned URL. Whether this resolves is decided by the `storage.files`
 * select permission for whoever asks, and an `<img>` tag always asks
 * anonymously: it sends no Authorization header, so storage answers it as the
 * `public` role. A file attached to a published item loads for everyone, and
 * the same URL for a private one is a 404, with no expiry to manage either way.
 */
export const fileURL = (
  client: NhostClient,
  id: string,
  transform?: ImageTransform,
): string => {
  const url = `${client.storage.baseURL}/files/${id}`;

  return transform ? withTransform(url, transform) : url;
};

/**
 * Whether `avatarUrl` is the avatar this project stored for `userId`.
 *
 * `backend/functions/avatar.ts` keeps one file per user, keyed to their own
 * id, so the URL it records is this project's `<storage>/files/<user id>` with
 * a cache-busting query string on the end. An account that has never uploaded
 * one carries the picture auth assigned at sign-up instead, which lives on
 * another host and is nothing this project can presign.
 *
 * The two are read in completely different ways, which is why this exists: a
 * stored avatar is private until its owner publishes their profile, so the
 * owner's own view of it has to be fetched with their session, while the
 * assigned one is a public URL that needs no such thing.
 */
export const isStoredAvatarURL = (
  baseURL: string,
  avatarUrl: string | null | undefined,
  userId: string,
): boolean => {
  if (!avatarUrl) {
    return false;
  }

  return avatarUrl.split('?')[0] === `${baseURL}/files/${userId}`;
};
