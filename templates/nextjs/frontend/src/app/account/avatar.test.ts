import { describe, expect, it } from 'vitest';
import {
  AVATAR_WIDTHS,
  avatarFileIdFrom,
  avatarSrc,
  avatarUrlFor,
  isAvatarWidth,
  isFileId,
} from '@/app/account/avatar';

const FILE_ID = '0b5e3f6c-8d2a-4c1e-9f7b-3a6d2e1c4b5a';

describe('isFileId', () => {
  it('takes a UUID in either case', () => {
    expect(isFileId(FILE_ID)).toBe(true);
    expect(isFileId(FILE_ID.toUpperCase())).toBe(true);
  });

  it.each([
    '',
    '..',
    'file-1',
    `${FILE_ID}/..`,
    `../${FILE_ID}`,
    ` ${FILE_ID}`,
  ])('refuses %j', (id) => {
    expect(isFileId(id)).toBe(false);
  });
});

describe('avatarFileIdFrom', () => {
  it('reads back the id avatarUrlFor wrote', () => {
    expect(avatarFileIdFrom(avatarUrlFor(FILE_ID))).toBe(FILE_ID);
  });

  it.each([
    undefined,
    'https://gravatar.example/x',
    `https://elsewhere.example/api/avatar/${FILE_ID}`,
    '/api/avatar/',
    '/api/avatar/..',
    '/api/avatar/../storage',
  ])('finds no file in %j', (url) => {
    expect(avatarFileIdFrom(url)).toBeUndefined();
  });
});

describe('isAvatarWidth', () => {
  it('takes the widths the pages actually render at', () => {
    for (const width of AVATAR_WIDTHS) {
      expect(isAvatarWidth(width)).toBe(true);
    }
  });

  // The route hands this whatever `?w=` held, so everything a query string
  // can carry has to come back false rather than reach storage.
  it.each([0, -1, 65, 8000, 64.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %j',
    (width) => {
      expect(isAvatarWidth(width)).toBe(false);
    },
  );
});

describe('avatarSrc', () => {
  it('asks for the width on a URL this app serves', () => {
    expect(avatarSrc(avatarUrlFor(FILE_ID), 192)).toBe(
      `/api/avatar/${FILE_ID}?w=192`,
    );
  });

  // Gravatar sizes with `s`, and anything else the user put in avatar_url
  // has its own scheme or none. Ours is the only one we know how to ask.
  it.each([
    'https://gravatar.example/x',
    `https://elsewhere.example/api/avatar/${FILE_ID}`,
  ])('leaves %j alone', (url) => {
    expect(avatarSrc(url, 64)).toBe(url);
  });
});
