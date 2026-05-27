import {
  getCapitalizedTableLikeObjectTypeLabel,
  getTableLikeObjectTypeLabel,
} from '@/features/orgs/projects/database/dataGrid/utils/getTableLikeObjectTypeLabel/getTableLikeObjectTypeLabel';

describe('getTableLikeObjectTypeLabel', () => {
  test('returns user-facing labels for table-like database object types', () => {
    expect(getTableLikeObjectTypeLabel('ORDINARY TABLE')).toBe('table');
    expect(getTableLikeObjectTypeLabel('VIEW')).toBe('view');
    expect(getTableLikeObjectTypeLabel('MATERIALIZED VIEW')).toBe(
      'materialized view',
    );
    expect(getTableLikeObjectTypeLabel('FOREIGN TABLE')).toBe('foreign table');
  });

  test('defaults to table when object type is unavailable', () => {
    expect(getTableLikeObjectTypeLabel()).toBe('table');
    expect(getCapitalizedTableLikeObjectTypeLabel()).toBe('Table');
  });

  test('capitalizes multi-word labels without changing the rest', () => {
    expect(getCapitalizedTableLikeObjectTypeLabel('MATERIALIZED VIEW')).toBe(
      'Materialized view',
    );
  });
});
