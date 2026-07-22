import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

describe('getSingleQueryParam', () => {
  it('returns the first repeated query value', () => {
    expect(getSingleQueryParam(['first', 'second'])).toBe('first');
  });

  it('returns undefined for an empty array', () => {
    expect(getSingleQueryParam([])).toBeUndefined();
  });

  it('returns a scalar query value unchanged', () => {
    expect(getSingleQueryParam('value')).toBe('value');
  });

  it('returns undefined for an absent query value', () => {
    expect(getSingleQueryParam(undefined)).toBeUndefined();
  });
});
