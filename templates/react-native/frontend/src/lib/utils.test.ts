import { first } from '@/lib/utils';

describe('first', () => {
  it('reads a repeated param as its first value', () => {
    expect(first('a')).toBe('a');
    expect(first(['a', 'b'])).toBe('a');
    expect(first([])).toBeUndefined();
    expect(first(undefined)).toBeUndefined();
  });
});
