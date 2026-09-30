import { describe, expect, it } from 'vitest';
import {
  type ImageTransform,
  isStoredAvatarURL,
  withTransform,
} from '@/lib/storage';

describe('withTransform', () => {
  it('starts a query string when there is not one', () => {
    expect(withTransform('https://s.example/v1/files/abc', { w: 96 })).toBe(
      'https://s.example/v1/files/abc?w=96',
    );
  });

  // The avatar function records its file with a cache-busting query string, so
  // a transform has to be appended to what is already there rather than
  // replace it.
  it('keeps an existing query string', () => {
    expect(
      withTransform('https://s.example/v1/files/abc?updatedAt=123', {
        w: 96,
        q: 80,
      }),
    ).toBe('https://s.example/v1/files/abc?updatedAt=123&w=96&q=80');
  });

  it('leaves the URL alone when nothing was asked for', () => {
    expect(withTransform('https://s.example/v1/files/abc', {})).toBe(
      'https://s.example/v1/files/abc',
    );
    expect(
      withTransform('https://s.example/v1/files/abc', { w: undefined }),
    ).toBe('https://s.example/v1/files/abc');
  });

  it('encodes values', () => {
    expect(
      withTransform('https://s.example/v1/files/abc', {
        f: 'a b&q=1' as ImageTransform['f'],
      }),
    ).toBe('https://s.example/v1/files/abc?f=a%20b%26q%3D1');
  });
});

// Which of the two kinds of avatar URL this is decides how it can be read at
// all: a stored one is only as readable as its owner's page, which is on by
// default and which they can turn off, so the owner's own view of it has to be
// fetched with their session to work either way round. Getting this wrong is
// what made a freshly uploaded picture render as a blank initial for the
// person who had just uploaded it.
describe('isStoredAvatarURL', () => {
  const base = 'https://s.example/v1';
  const userId = '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24';

  it('recognises the file the avatar function stored', () => {
    expect(isStoredAvatarURL(base, `${base}/files/${userId}`, userId)).toBe(
      true,
    );
  });

  // The avatar function always appends one, so this is the normal case rather
  // than the exception.
  it('ignores the cache-busting query string', () => {
    expect(
      isStoredAvatarURL(base, `${base}/files/${userId}?updatedAt=123`, userId),
    ).toBe(true);
  });

  // Auth assigns this at sign-up. Fetching it through this project's storage
  // would ask for a file that was never there.
  it('rejects a picture on another host', () => {
    expect(
      isStoredAvatarURL(base, 'https://gravatar.example/avatar/abc', userId),
    ).toBe(false);
  });

  it("rejects a file that is not this user's", () => {
    expect(isStoredAvatarURL(base, `${base}/files/somebody-else`, userId)).toBe(
      false,
    );
    // A prefix match would accept this one.
    expect(isStoredAvatarURL(base, `${base}/files/${userId}-2`, userId)).toBe(
      false,
    );
  });

  it('rejects the absence of an avatar', () => {
    expect(isStoredAvatarURL(base, null, userId)).toBe(false);
    expect(isStoredAvatarURL(base, undefined, userId)).toBe(false);
    expect(isStoredAvatarURL(base, '', userId)).toBe(false);
  });
});
