import {
  BetweenHorizontalEnd,
  List,
  ScanEye,
  SquareFunction,
  Table2,
  View,
} from 'lucide-react';
import getDatabaseObjectIcon from './getDatabaseObjectIcon';

describe('getDatabaseObjectIcon', () => {
  it('should return SquareFunction for FUNCTION', () => {
    expect(getDatabaseObjectIcon('FUNCTION', false)).toBe(SquareFunction);
  });

  it('should return ScanEye for VIEW', () => {
    expect(getDatabaseObjectIcon('VIEW', false)).toBe(ScanEye);
  });

  it('should return View for MATERIALIZED VIEW', () => {
    expect(getDatabaseObjectIcon('MATERIALIZED VIEW', false)).toBe(View);
  });

  it('should return BetweenHorizontalEnd for FOREIGN TABLE', () => {
    expect(getDatabaseObjectIcon('FOREIGN TABLE', false)).toBe(
      BetweenHorizontalEnd,
    );
  });

  it('should return List for enum tables', () => {
    expect(getDatabaseObjectIcon('ORDINARY TABLE', true)).toBe(List);
  });

  it('should return Table2 for ordinary non-enum tables', () => {
    expect(getDatabaseObjectIcon('ORDINARY TABLE', false)).toBe(Table2);
  });

  it('should return ScanEye for VIEW even when isEnum is true', () => {
    expect(getDatabaseObjectIcon('VIEW', true)).toBe(ScanEye);
  });
});
