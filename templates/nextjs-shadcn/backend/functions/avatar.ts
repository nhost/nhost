import type { Request, Response } from 'express';
import { Jimp } from 'jimp';

// The avatars bucket caps files at 1 MiB, which only has to fit this resized
// output. The original photo is bounded by the runtime's 6 MB JSON body limit.
// jimp over sharp because the functions runtime bundles each function with
// esbuild, and native modules do not survive bundling; jimp is pure JS.
const AVATAR_SIZE = 512;

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

  return Buffer.from(image.replace(/^data:[^;]+;base64,/, ''), 'base64');
}

// One file per user, keyed by their id: re-uploading replaces the previous
// avatar instead of accumulating orphaned files.
async function storeAvatar(
  fileId: string,
  avatar: Uint8Array,
): Promise<boolean> {
  const blob = new Blob([avatar], { type: 'image/jpeg' });

  const replace = new FormData();
  replace.append('file', blob, 'avatar.jpg');

  const replaced = await fetch(`${storageURL}/files/${fileId}`, {
    method: 'PUT',
    headers: { 'x-hasura-admin-secret': adminSecret },
    body: replace,
  });
  if (replaced.ok) {
    return true;
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

  const image = decodeImage(req.body);
  if (!image) {
    res.status(400).json({ error: 'send { "image": "<base64>" }' });
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
