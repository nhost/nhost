// Runs on Node's built-in test runner with native TypeScript type stripping:
// `node --test "_tests/*.test.ts"`, no extra dependencies. Native type
// stripping needs Node >= 22.18 (or any Node 24+); older 22.x releases cannot
// run this file. The functions runtime never routes this file because
// server.js ignores `_*` paths, so a test here is never reachable as an HTTP
// function.
//
// These are memory-safety regressions for the avatar upload handler. Each
// input declares tiny dimensions to `image-size` yet steers a decoder into an
// allocation the pixel bound never sees. The handler must reject all of them
// before Jimp.read, and must still accept ordinary images.
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { Jimp } from 'jimp';
import handler from '../avatar.ts';

type Handler = typeof handler;

// The handler reads its service URLs from the environment at import time and
// only ever spends them as fetch targets, which the stub below intercepts by
// path, so the tests neither set nor depend on those variables.

// A signed-in caller, and storage plus GraphQL that always succeed. Anything
// the handler still lets through therefore lands on a 200, so a rejection test
// fails loudly if the guard it covers is ever removed.
function installFetchStub(): void {
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    if (url.endsWith('/user')) {
      return new Response(JSON.stringify({ id: 'test-user-id' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

type Captured = { statusCode: number | undefined; body: unknown };

async function post(image: Buffer): Promise<Captured> {
  const captured: Captured = { statusCode: undefined, body: undefined };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      captured.body = payload;
      return res;
    },
  };
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: { image: image.toString('base64') },
  };
  await handler(
    req as unknown as Parameters<Handler>[0],
    res as unknown as Parameters<Handler>[1],
  );
  return captured;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const label = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([label, data])) >>> 0);
  return Buffer.concat([length, label, data, crc]);
}

// A 45-byte PNG that is all header and no pixels: the 8-byte signature, one
// IHDR carrying the declared dimensions, and an empty IEND, with no IDAT.
// image-size reads the dimensions straight out of the IHDR, so the handler
// decides on the pixel bound before Jimp.read is ever called. This is the input
// that tells the two bounds apart at no allocation cost: at 4096x4096 (16.8 MP)
// it is inside the old 50 MP bound and outside the 16 MP one, so the pixel
// bound is the only thing that can answer 413. Shrink the same buffer to a size
// under the bound and the missing pixel data instead surfaces as a 400 decode
// failure. A 50 MP bound would not answer 413 for the large buffer at all:
// 4096x4096 clears 50 MP, and a header-only PNG that large decodes to a blank
// bitmap rather than throwing, so the handler would return 200 and the
// oversized decode would slip through.
function headerOnlyPng(width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// A valid 1x1 Adam7-interlaced grayscale PNG. It is deliberately not a bomb:
// the fix keys on IHDR byte 28, the interlace method, because pngjs inflates
// the interlaced branch with no output cap while the non-interlaced branch
// caps it. The real attack inflates gigabytes through this exact path; a 1x1
// image exercises the same rejection without the memory cost.
function interlacedPng(): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 1;
  const idat = zlib.deflateSync(Buffer.from([0x00, 0x80]));
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// A PNG carrying two IHDR chunks: the first declares interlace=0, which is all
// a fixed read at byte 28 can see, while the second declares interlace=1.
// pngjs re-parses metadata on every IHDR with no duplicate check, so the later
// chunk wins and parser-sync takes the uncapped inflate branch. The real
// attack ships a multi-gigabyte IDAT through that branch; a 1x1 image drives
// the same double-IHDR bypass without the allocation.
function doubleIhdrPng(): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = (interlace: number): Buffer => {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(1, 0);
    data.writeUInt32BE(1, 4);
    data[8] = 8;
    data[9] = 0;
    data[10] = 0;
    data[11] = 0;
    data[12] = interlace;
    return pngChunk('IHDR', data);
  };
  const idat = zlib.deflateSync(Buffer.from([0x00, 0x80]));
  return Buffer.concat([
    signature,
    ihdr(0),
    ihdr(1),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// A valid single-frame GIF whose logical screen descriptor is rewritten to
// 1x1 while the image descriptor rect stays large. image-size and jimp both
// report 1x1, but omggif allocates from the frame rect. The real attack pushes
// the rect to 65535x65535 (about 4.3 GB); a small rect proves the same escape
// without the allocation.
async function oversizedFrameGif(): Promise<Buffer> {
  const gif = Buffer.from(
    await new Jimp({ width: 64, height: 64, color: 0xffffffff }).getBuffer(
      'image/gif',
    ),
  );
  gif[6] = 1;
  gif[7] = 0;
  gif[8] = 1;
  gif[9] = 0;
  return gif;
}

describe('avatar upload memory-safety guards', () => {
  before(installFetchStub);

  it('rejects a TIFF, which declares only its first page', async () => {
    const tiff = Buffer.from(
      await new Jimp({ width: 4, height: 4, color: 0xff0000ff }).getBuffer(
        'image/tiff',
      ),
    );
    const { statusCode } = await post(tiff);
    assert.ok(
      statusCode !== undefined && statusCode >= 400 && statusCode < 500,
      `expected a 4xx, got ${statusCode}`,
    );
  });

  it('rejects an interlaced PNG, whose inflate is uncapped', async () => {
    const { statusCode } = await post(interlacedPng());
    assert.ok(
      statusCode !== undefined && statusCode >= 400 && statusCode < 500,
      `expected a 4xx, got ${statusCode}`,
    );
  });

  it('rejects a GIF whose frame rect leaves the logical screen', async () => {
    const { statusCode } = await post(await oversizedFrameGif());
    assert.ok(
      statusCode !== undefined && statusCode >= 400 && statusCode < 500,
      `expected a 4xx, got ${statusCode}`,
    );
  });

  it('rejects a PNG whose second IHDR flips interlace back on', async () => {
    const { statusCode } = await post(doubleIhdrPng());
    assert.ok(
      statusCode !== undefined && statusCode >= 400 && statusCode < 500,
      `expected a 4xx, got ${statusCode}`,
    );
  });

  it('413s a header-only PNG over the pixel bound, and only 400s under it', async () => {
    const tooMany = await post(headerOnlyPng(4096, 4096));
    assert.equal(tooMany.statusCode, 413);
    assert.deepEqual(tooMany.body, {
      error:
        'the image has too many pixels. Keep it under 16 megapixels, for example 4000x4000.',
    });

    const small = await post(headerOnlyPng(100, 100));
    assert.equal(small.statusCode, 400);
    assert.deepEqual(small.body, { error: 'the image could not be decoded' });
  });

  it('accepts an ordinary non-interlaced PNG', async () => {
    const png = Buffer.from(
      await new Jimp({ width: 16, height: 16, color: 0x0000ffff }).getBuffer(
        'image/png',
      ),
    );
    const { statusCode } = await post(png);
    assert.equal(statusCode, 200);
  });

  it('accepts an ordinary GIF whose frame fills its screen', async () => {
    const gif = Buffer.from(
      await new Jimp({ width: 32, height: 32, color: 0x00ff00ff }).getBuffer(
        'image/gif',
      ),
    );
    const { statusCode } = await post(gif);
    assert.equal(statusCode, 200);
  });
});
