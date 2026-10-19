import { isVersionGte } from './compareVersions';

describe('isVersionGte', () => {
  it('compares major, minor and patch segments', () => {
    expect(isVersionGte('0.46.0', '0.46.0')).toBe(true);
    expect(isVersionGte('0.46.1', '0.46.0')).toBe(true);
    expect(isVersionGte('0.47.0', '0.46.9')).toBe(true);
    expect(isVersionGte('1.0.0', '0.99.99')).toBe(true);
    expect(isVersionGte('0.45.9', '0.46.0')).toBe(false);
    expect(isVersionGte('0.46.0', '0.46.1')).toBe(false);
  });

  it('ignores a leading "v" and pre-release suffixes', () => {
    expect(isVersionGte('v2.48.5-ce', 'v2.33.0')).toBe(true);
    expect(isVersionGte('v2.33.0-ce', 'v2.33.0')).toBe(true);
    expect(isVersionGte('v2.25.1-ce', 'v2.33.0')).toBe(false);
  });
});
