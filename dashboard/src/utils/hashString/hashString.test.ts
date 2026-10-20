import { hashString } from '@/utils/hashString';

describe('hashString', () => {
  it.each([
    ['', 0],
    ['a', 97],
    ['abc', 96354],
    ['public', 3317543529],
    ['polygenelubricants', 2147483648],
  ])('hashes %j to %i', (value, expected) => {
    expect(hashString(value)).toBe(expected);
  });
});
