import type { Request, Response } from 'express';
import { imageSize } from 'image-size';
import { Jimp } from 'jimp';

// The avatars bucket caps files at 1 MiB, which only has to fit this resized
// output. The original photo is bounded by the runtime's 6 MB JSON body limit.
// jimp over sharp because the functions runtime bundles each function with
// esbuild, and native modules do not survive bundling; jimp is pure JS.
const AVATAR_SIZE = 512;

// This endpoint is reachable on its own, so the profile page's own limit is
// not a limit. Both bounds are on the input rather than the output, because
// decoding is the expensive part: a few hundred kilobytes of PNG can declare
// 30000x30000 and become gigabytes of pixels the moment jimp reads it. The
// pixel bound is therefore read out of the file header, before any decode. A
// byte cap cannot stand in for it: the whole trick is that the bytes are few.
// image-size is pure JS, like jimp, so it survives the esbuild bundling the
// functions runtime does.
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
// 4000x4000, so an ordinary 12 MP phone photo fits. The 64 MB RGBA bitmap jimp
// decodes to is only part of the cost: with the decoder's own buffers (pngjs
// inflate, or the jpeg-js path most photos take), jimp's bitmap and the copies
// made while resizing, a real 16 MP JPEG driven through this whole handler
// peaks around 835 MB of resident memory, so size a container on that figure
// and not on the bitmap alone. The output is only 512x512, so a bound higher
// than this buys nothing but a larger transient allocation per in-flight
// request, which is the memory blow-up the bound exists to prevent.
const MAX_AVATAR_PIXELS = 16 * 1000 * 1000;

// The pixel bound above only protects formats whose header dimensions bound
// what jimp actually allocates. TIFF is excluded because image-size reads only
// the first IFD while jimp decodes every page, so a 1x1 first page passes the
// bound while a later 8000x8000 page still allocates in full. A missing type
// means the format was not recognised, which is also a rejection. bmp-ts and
// jpeg-js do stay within the header fields image-size reads (jpeg-js also
// self-limits its resolution and memory), but PNG and GIF each reach a second
// decode path the header alone does not bound, so unboundedDecodeError below
// runs one more per-format header check on those two before Jimp.read.
const ALLOWED_AVATAR_TYPES = new Set(['jpg', 'png', 'gif', 'bmp']);

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

// PNG and GIF pass the allowlist and the pixel bound but still reach a decode
// path the header dimensions do not bound, so each needs one more header read
// before Jimp.read. Returns the reason to reject, or null to proceed.
function unboundedDecodeError(image: Buffer, type: string): string | null {
  if (type === 'png') {
    // pngjs inflates an interlaced PNG with no maxOutputLength (parser-sync.js,
    // the metaData.interlace branch), while the non-interlaced branch caps the
    // inflate at the header-sized buffer. An 8x8 interlaced image can therefore
    // inflate to gigabytes no matter what the pixel bound says. A fixed read at
    // byte 28 sees only the first IHDR, so a second IHDR that flips interlace
    // back on slips past it; pngInterlaced walks the chunk stream and judges
    // every IHDR instead.
    if (pngInterlaced(image)) {
      return 'save the image as a non-interlaced PNG and upload it again';
    }
    return null;
  }
  if (type === 'gif') {
    // omggif allocates frame.width * frame.height from the first image
    // descriptor rect, not the logical screen that image-size and jimp report,
    // so a 1x1 screen can carry a 30000x30000 frame that escapes the pixel
    // bound. Reject any GIF whose first frame rect leaves the logical screen.
    return gifFrameExceedsScreen(image)
      ? 'the GIF frame is larger than the image'
      : null;
  }
  return null;
}

// Walks the PNG chunk stream the way pngjs does and reports whether the decode
// would take the uncapped interlaced inflate branch. A fixed read at byte 28
// sees only the first IHDR, so a PNG carrying a second IHDR with interlace=1
// slips past it: pngjs re-parses metadata on every IHDR (parser.js
// _parseIHDR, with no duplicate check) and the later chunk wins. This reads
// the interlace method out of every IHDR, and rejects a duplicate IHDR outright
// since a valid PNG carries exactly one. Reads bytes only, allocates nothing,
// and always advances p, so a truncated or malformed stream cannot loop or
// throw.
function pngInterlaced(image: Buffer): boolean {
  // An 8-byte signature, then chunks: length (u32be), type (4), data, crc (4).
  let p = 8;
  let ihdrs = 0;
  while (p + 8 <= image.length) {
    const length = image.readUInt32BE(p);
    if (image.toString('latin1', p + 4, p + 8) === 'IHDR') {
      ihdrs++;
      if (ihdrs > 1) {
        return true;
      }
      // interlace is the 13th byte of the IHDR data; a short IHDR cannot bomb,
      // so leave it for Jimp.read to reject.
      if (p + 8 + 13 > image.length) {
        return false;
      }
      if (image[p + 8 + 12] === 1) {
        return true;
      }
    }
    // length (4) + type (4) + crc (4) plus the data; always advances by >= 12.
    p += 12 + length;
  }
  return false;
}

// Walks a GIF to its first image descriptor the way omggif does and reports
// whether that frame rect extends past the logical screen image-size measured.
// Reads bytes only and allocates nothing, so it runs before the decode it
// guards.
function gifFrameExceedsScreen(image: Buffer): boolean {
  // The 6-byte header is followed by the logical screen descriptor.
  if (image.length < 13) {
    return false;
  }
  const screenWidth = image[6] | (image[7] << 8);
  const screenHeight = image[8] | (image[9] << 8);
  const packed = image[10];

  // Skip the global color table when the packed field flags one: 2^(N+1)
  // entries of three bytes each.
  let p = 13;
  if (packed & 0x80) {
    p += 3 * (1 << ((packed & 0x7) + 1));
  }

  while (p < image.length) {
    const block = image[p++];
    if (block === 0x21) {
      // Extension: a label byte, then size-prefixed sub-blocks ending at 0.
      p++;
      while (p < image.length) {
        const size = image[p++];
        if (!size) {
          break;
        }
        p += size;
      }
      continue;
    }
    if (block === 0x2c) {
      // Image descriptor: left, top, width, height, each a little-endian u16.
      if (p + 8 > image.length) {
        return true;
      }
      const left = image[p] | (image[p + 1] << 8);
      const top = image[p + 2] | (image[p + 3] << 8);
      const width = image[p + 4] | (image[p + 5] << 8);
      const height = image[p + 6] | (image[p + 7] << 8);
      return left + width > screenWidth || top + height > screenHeight;
    }
    // Trailer or anything unexpected: no frame for jimp to blow up on.
    return false;
  }
  return false;
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
    res.status(400).json({ error: 'send { "image": "<base64>" }' });
    return;
  }

  if (image.length > MAX_AVATAR_BYTES) {
    res
      .status(413)
      .json({ error: 'the image is too large. Keep it under 4 MB.' });
    return;
  }

  let declared: { width: number; height: number; type?: string };
  try {
    declared = imageSize(image);
  } catch {
    res.status(400).json({ error: 'the image could not be decoded' });
    return;
  }

  if (!declared.type || !ALLOWED_AVATAR_TYPES.has(declared.type)) {
    res.status(400).json({ error: 'upload a JPEG, PNG, GIF or BMP image' });
    return;
  }

  if (declared.width * declared.height > MAX_AVATAR_PIXELS) {
    res.status(413).json({
      error:
        'the image has too many pixels. Keep it under 16 megapixels, for example 4000x4000.',
    });
    return;
  }

  const decodeError = unboundedDecodeError(image, declared.type);
  if (decodeError) {
    res.status(400).json({ error: decodeError });
    return;
  }

  let avatar: Uint8Array;
  try {
    const picture = await Jimp.read(image);

    // A backstop for a format whose header understates what it decodes to.
    // The bound that matters is the one above, which runs first.
    if (picture.width * picture.height > MAX_AVATAR_PIXELS) {
      res.status(413).json({
        error:
          'the image has too many pixels. Keep it under 16 megapixels, for example 4000x4000.',
      });
      return;
    }

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
