import {
  BetweenHorizontalEnd,
  List,
  ScanEye,
  SquareFunction,
  Table2,
  View,
} from 'lucide-react';
import { describe, expect, test } from 'vitest';
import getDatabaseObjectIcon from './getDatabaseObjectIcon';

describe('getDatabaseObjectIcon', () => {
  test('should return SquareFunction for FUNCTION', () => {
    expect(getDatabaseObjectIcon('FUNCTION', false)).toBe(SquareFunction);
  });

  test('should return ScanEye for VIEW', () => {
    expect(getDatabaseObjectIcon('VIEW', false)).toBe(ScanEye);
  });

  test('should return View for MATERIALIZED VIEW', () => {
    expect(getDatabaseObjectIcon('MATERIALIZED VIEW', false)).toBe(View);
  });

  test('should return BetweenHorizontalEnd for FOREIGN TABLE', () => {
    expect(getDatabaseObjectIcon('FOREIGN TABLE', false)).toBe(
      BetweenHorizontalEnd,
    );
  });

  test('should return List for enum tables', () => {
    expect(getDatabaseObjectIcon('ORDINARY TABLE', true)).toBe(List);
  });

  test('should return Table2 for ordinary non-enum tables', () => {
    expect(getDatabaseObjectIcon('ORDINARY TABLE', false)).toBe(Table2);
  });

  test('should return ScanEye for VIEW even when isEnum is true', () => {
    expect(getDatabaseObjectIcon('VIEW', true)).toBe(ScanEye);
  });
});
