import {
  defaultColorFor,
  getColorEntry,
  hashAppId,
  isProjectColorName,
  PROJECT_COLOR_PALETTE,
} from './projectColor';

describe('hashAppId', () => {
  it('is deterministic', () => {
    expect(hashAppId('aaa-bbb-ccc')).toBe(hashAppId('aaa-bbb-ccc'));
  });

  it('returns non-negative integers', () => {
    const ids = ['', 'a', 'long-uuid-string-1234', '00000000-0000-0000'];
    for (const id of ids) {
      const h = hashAppId(id);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces different hashes for different inputs in most cases', () => {
    expect(hashAppId('proj-a')).not.toBe(hashAppId('proj-b'));
  });
});

describe('defaultColorFor', () => {
  it('returns one of the palette colors', () => {
    const names = PROJECT_COLOR_PALETTE.map((entry) => entry.name);
    const ids = ['x', 'aaa', '0123-4567-89ab-cdef'];
    for (const id of ids) {
      expect(names).toContain(defaultColorFor(id));
    }
  });

  it('is deterministic', () => {
    expect(defaultColorFor('proj-1')).toBe(defaultColorFor('proj-1'));
  });

  it('hits every palette color across many ids', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i += 1) {
      const c = defaultColorFor(`uuid-${i}`);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    expect(counts.size).toBe(PROJECT_COLOR_PALETTE.length);
  });
});

describe('isProjectColorName', () => {
  it('accepts palette names', () => {
    expect(isProjectColorName('red')).toBe(true);
    expect(isProjectColorName('blue')).toBe(true);
  });

  it('rejects others', () => {
    expect(isProjectColorName('mauve')).toBe(false);
    expect(isProjectColorName(undefined)).toBe(false);
    expect(isProjectColorName(42)).toBe(false);
    expect(isProjectColorName(null)).toBe(false);
  });
});

describe('getColorEntry', () => {
  it('returns matching entry', () => {
    expect(getColorEntry('red').name).toBe('red');
    expect(getColorEntry('blue').dot).toBe('bg-blue-500');
  });
});
