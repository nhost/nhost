import { describe, expect, it } from 'vitest';
import { storedFileParams } from '@/lib/useStoredFile';

// The bug this pins cost an hour to find, because every part of it looked
// right: the backend served the image, CORS allowed it, the session attached.
// `@nhost/nhost-js` 4.7.2 encodes parameters with a bare `String(value)`, so a
// single unset key went out as the literal `h=undefined`, storage answered 400,
// and the thumbnail rendered as a blank square with nothing logged.
describe('storedFileParams', () => {
  it('drops keys that were never asked for', () => {
    expect(storedFileParams({ w: 96, q: 80, f: 'webp' })).toEqual({
      w: 96,
      q: 80,
      f: 'webp',
    });
  });

  it('drops an explicitly undefined key', () => {
    // The shape `FileThumbnail` actually produces: destructuring a transform
    // without `h` yields `h: undefined`, which must not reach the query string.
    expect(storedFileParams({ w: 96, h: undefined, q: 80, f: 'webp' })).toEqual(
      { w: 96, q: 80, f: 'webp' },
    );
  });

  it('never yields the key at all, not merely an undefined value', () => {
    // `toEqual` ignores undefined values, so it would pass even if the key
    // survived. The wire format is what matters here, so assert on the keys.
    expect(
      Object.keys(storedFileParams({ w: 96, h: undefined, q: 80, f: 'webp' })),
    ).toEqual(['w', 'q', 'f']);
  });

  it('keeps zero, which is a value and not an absence', () => {
    expect(Object.keys(storedFileParams({ w: 0, q: 0 }))).toEqual(['w', 'q']);
  });

  it('survives an empty transform', () => {
    expect(storedFileParams({})).toEqual({});
    expect(Object.keys(storedFileParams({ h: undefined }))).toEqual([]);
  });
});
