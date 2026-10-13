import { describe, expect, it } from 'vitest';
import { avatarFileIdFrom, avatarUrlFor, isFileId } from '@/app/account/avatar';

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
