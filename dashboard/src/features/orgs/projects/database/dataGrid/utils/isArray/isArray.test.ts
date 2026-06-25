import isArray from './isArray';

describe('isArray', () => {
  it('returns true for array types', () => {
    expect(isArray('integer[]')).toBe(true);
    expect(isArray('text[]')).toBe(true);
    expect(isArray('character varying(255)[]')).toBe(true);
    expect(isArray('timestamp with time zone[]')).toBe(true);
  });

  it('returns true for multi-dimensional arrays', () => {
    expect(isArray('integer[][]')).toBe(true);
  });

  it('returns false for scalar types', () => {
    expect(isArray('integer')).toBe(false);
    expect(isArray('character varying(255)')).toBe(false);
    expect(isArray('uuid')).toBe(false);
  });

  it('returns false for empty or nullish input', () => {
    expect(isArray('')).toBe(false);
    expect(isArray(null)).toBe(false);
    expect(isArray(undefined)).toBe(false);
  });
});
