import getObjectTypeUrlSegment from './getObjectTypeUrlSegment';

describe('getObjectTypeUrlSegment', () => {
  it('should return "tables" for ORDINARY TABLE', () => {
    expect(getObjectTypeUrlSegment('ORDINARY TABLE')).toBe('tables');
  });

  it('should return "tables" for FOREIGN TABLE', () => {
    expect(getObjectTypeUrlSegment('FOREIGN TABLE')).toBe('tables');
  });

  it('should return "tables" for VIEW', () => {
    expect(getObjectTypeUrlSegment('VIEW')).toBe('tables');
  });

  it('should return "tables" for MATERIALIZED VIEW', () => {
    expect(getObjectTypeUrlSegment('MATERIALIZED VIEW')).toBe('tables');
  });

  it('should return "functions" for FUNCTION', () => {
    expect(getObjectTypeUrlSegment('FUNCTION')).toBe('functions');
  });
});
