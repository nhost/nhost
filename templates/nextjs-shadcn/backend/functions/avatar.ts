import type { Request, Response } from 'express';
import { imageSize } from 'image-size';
import { Jimp } from 'jimp';

// The avatars bucket caps files at 1 MiB, which only has to fit this resized
// output. The runtime's 6 MB JSON body limit bounds the *encoded* request,
// not the work this handler does with it: a small, deeply-compressed image
// can still decode to a bitmap thousands of times larger than its byte size,
// so MAX_ENCODED_BYTES and MAX_AVATAR_DIMENSION below bound the encoded input
// and the decoded pixel count directly, ahead of Jimp.read ever allocating.
// jimp over sharp because the functions runtime bundles each function with
// esbuild, and native modules do not survive bundling; jimp is pure JS.
const AVATAR_SIZE = 512;

// Matches the frontend's own cap (AvatarPicker.tsx, actions.ts) so legitimate
// uploads are unaffected; this endpoint is reachable directly, so the client
// cap alone does not bound it.
const MAX_ENCODED_BYTES = 4 * 1024 * 1024;

// image-size only parses the header, so this runs before Jimp decodes any
// pixels. Comfortably above real camera output, far below what would let a
// tiny file expand into a multi-hundred-megabyte bitmap.
const MAX_AVATAR_DIMENSION = 4096;

const authURL = process.env.NHOST_AUTH_URL as string;
const storageURL = process.env.NHOST_STORAGE_URL as string;
const graphqlURL = process.env.NHOST_GRAPHQL_URL as string;
const adminSecret = process.env.NHOST_ADMIN_SECRET as string;

async function authenticatedUserID(req: Request): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const response = await fetch(`${authURL}/user`, {
    headers: { authorization: header },
  });
  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as { id?: string };
  return user.id ?? null;
}

function decodeImage(body: unknown): Buffer | null {
  const image = (body as { image?: unknown } | null)?.image;
  if (typeof image !== 'string' || image === '') {
    return null;
  }

  const decoded = Buffer.from(
    image.replace(/^data:[^;]+;base64,/, ''),
    'base64',
  );
  if (decoded.length === 0 || decoded.length > MAX_ENCODED_BYTES) {
    return null;
  }

  return decoded;
}

// Reads only the header, so this runs ahead of Jimp.read and rejects a
// pixel-bomb (a tiny, highly-compressed file that decodes to a bitmap far
// larger than its byte size) before anything allocates the decoded bitmap.
function plausibleDimensions(image: Buffer): boolean {
  try {
    const { width, height } = imageSize(image);
    return (
      width > 0 &&
      height > 0 &&
      width <= MAX_AVATAR_DIMENSION &&
      height <= MAX_AVATAR_DIMENSION
    );
  } catch {
    return false;
  }
}

// Looked up as admin rather than assumed: `PUT /files/:id` replaces whatever
// row already has that id and keeps its existing bucket, so PUTting blind
// would silently overwrite a row that only happens to share this id - the
// insert permission on `storage.files` stops a stranger from planting one on
// purpose, but this is the second half of that guard, not a duplicate of it.
async function existingAvatarFile(
  fileId: string,
): Promise<{ bucketId: string } | null> {
  const response = await fetch(graphqlURL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      query: `query ExistingAvatarFile($id: uuid!) {
        file(id: $id) { bucketId }
      }`,
      variables: { id: fileId },
    }),
  });

  const result = (await response.json()) as {
    data?: { file?: { bucketId: string } | null };
    errors?: unknown[];
  };
  if (!response.ok || result.errors) {
    // A failed lookup is not the same as a confirmed-absent file: falling
    // through to POST here is exactly the "unrelated error becomes a
    // duplicate-key failure" bug this function exists to avoid.
    throw new Error('avatar file lookup failed');
  }

  return result.data?.file ?? null;
}

// One file per user, keyed by their id: re-uploading replaces the previous
// avatar instead of accumulating orphaned files.
async function storeAvatar(
  fileId: string,
  avatar: Uint8Array,
): Promise<boolean> {
  const blob = new Blob([avatar], { type: 'image/jpeg' });

  let existing: { bucketId: string } | null;
  try {
    existing = await existingAvatarFile(fileId);
  } catch {
    return false;
  }

  // A row under this id outside `avatars` is not a bucket this endpoint ever
  // wrote to, so it is not this user's avatar to replace.
  if (existing && existing.bucketId !== 'avatars') {
    return false;
  }

  if (existing) {
    const replace = new FormData();
    replace.append('file', blob, 'avatar.jpg');

    const replaced = await fetch(`${storageURL}/files/${fileId}`, {
      method: 'PUT',
      headers: { 'x-hasura-admin-secret': adminSecret },
      body: replace,
    });
    return replaced.ok;
  }

  const upload = new FormData();
  upload.append('bucket-id', 'avatars');
  upload.append(
    'metadata[]',
    JSON.stringify({ id: fileId, name: 'avatar.jpg' }),
  );
  upload.append('file[]', blob, 'avatar.jpg');

  const uploaded = await fetch(`${storageURL}/files`, {
    method: 'POST',
    headers: { 'x-hasura-admin-secret': adminSecret },
    body: upload,
  });

  return uploaded.ok;
}

// A missing file is the end state being asked for, so a 404 is a success: it
// means someone already removed it, or there was never one to remove.
async function removeStoredAvatar(fileId: string): Promise<boolean> {
  const response = await fetch(`${storageURL}/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'x-hasura-admin-secret': adminSecret },
  });

  return response.ok || response.status === 404;
}

async function setAvatarURL(userId: string, url: string): Promise<boolean> {
  const response = await fetch(graphqlURL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      query: `mutation SetAvatar($id: uuid!, $url: String!) {
        updateUser(pk_columns: { id: $id }, _set: { avatarUrl: $url }) { id }
      }`,
      variables: { id: userId, url },
    }),
  });
  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as { errors?: unknown[] };
  return !result.errors;
}

export default async (req: Request, res: Response): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'use POST' });
    return;
  }

  const userId = await authenticatedUserID(req);
  if (!userId) {
    res.status(401).json({ error: 'sign in to change your avatar' });
    return;
  }

  // Removal is a flag on this endpoint rather than a DELETE because the SDK's
  // functions client only speaks POST.
  if ((req.body as { remove?: unknown } | null)?.remove === true) {
    if (!(await removeStoredAvatar(userId))) {
      res.status(502).json({ error: 'removing the avatar failed' });
      return;
    }

    // Emptied rather than nulled: auth's own column is NOT NULL, and an empty
    // string is what the UI reads as "draw the initial instead".
    if (!(await setAvatarURL(userId, ''))) {
      res.status(502).json({ error: 'clearing the avatar URL failed' });
      return;
    }

    res.status(200).json({ avatarUrl: '' });
    return;
  }

  const image = decodeImage(req.body);
  if (!image) {
    res.status(400).json({ error: 'send { "image": "<base64>" } under 4 MB' });
    return;
  }

  if (!plausibleDimensions(image)) {
    res.status(400).json({ error: 'the image dimensions are too large' });
    return;
  }

  let avatar: Uint8Array;
  try {
    const picture = await Jimp.read(image);
    picture.cover({ w: AVATAR_SIZE, h: AVATAR_SIZE });
    avatar = await picture.getBuffer('image/jpeg', { quality: 80 });
  } catch {
    res.status(400).json({ error: 'the image could not be decoded' });
    return;
  }

  if (!(await storeAvatar(userId, avatar))) {
    res.status(502).json({ error: 'storing the avatar failed' });
    return;
  }

  // The file id is stable across uploads, so the query string is what makes
  // browsers drop their cached copy after a change.
  const avatarUrl = `${storageURL}/files/${userId}?updatedAt=${Date.now()}`;

  if (!(await setAvatarURL(userId, avatarUrl))) {
    res.status(502).json({ error: 'updating the avatar URL failed' });
    return;
  }

  res.status(200).json({ avatarUrl });
};
