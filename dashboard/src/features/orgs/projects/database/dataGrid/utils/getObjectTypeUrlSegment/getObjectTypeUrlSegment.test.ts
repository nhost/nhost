import { describe, expect, test } from 'vitest';
import getObjectTypeUrlSegment from './getObjectTypeUrlSegment';

describe('getObjectTypeUrlSegment', () => {
  test('should return "tables" for ORDINARY TABLE', () => {
    expect(getObjectTypeUrlSegment('ORDINARY TABLE')).toBe('tables');
  });

  test('should return "tables" for FOREIGN TABLE', () => {
    expect(getObjectTypeUrlSegment('FOREIGN TABLE')).toBe('tables');
  });

  test('should return "tables" for VIEW', () => {
    expect(getObjectTypeUrlSegment('VIEW')).toBe('tables');
  });

  test('should return "tables" for MATERIALIZED VIEW', () => {
    expect(getObjectTypeUrlSegment('MATERIALIZED VIEW')).toBe('tables');
  });

  test('should return "functions" for FUNCTION', () => {
    expect(getObjectTypeUrlSegment('FUNCTION')).toBe('functions');
  });
});
