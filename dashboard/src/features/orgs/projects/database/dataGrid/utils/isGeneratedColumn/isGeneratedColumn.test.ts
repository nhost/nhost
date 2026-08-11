import isGeneratedColumn from './isGeneratedColumn';

describe('isGeneratedColumn', () => {
  it('returns true when is_generated is "ALWAYS"', () => {
    expect(isGeneratedColumn({ is_generated: 'ALWAYS' })).toBe(true);
  });

  it('returns false when is_generated is "NEVER"', () => {
    expect(isGeneratedColumn({ is_generated: 'NEVER' })).toBe(false);
  });

  it('returns false when is_generated is undefined', () => {
    expect(isGeneratedColumn({})).toBe(false);
  });

  it('returns false when is_generated is null', () => {
    expect(isGeneratedColumn({ is_generated: null })).toBe(false);
  });
});
