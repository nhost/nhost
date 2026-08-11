import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { buildDefaultOrderByClause } from './buildDefaultOrderByClause';

function column(
  overrides: Partial<NormalizedQueryDataRow> = {},
): NormalizedQueryDataRow {
  return {
    column_name: 'col',
    data_type: 'text',
    udt_name: 'text',
    primary_constraints: [],
    unique_constraints: [],
    ordinal_position: 1,
    ...overrides,
  };
}

describe('buildDefaultOrderByClause', () => {
  describe('primary key tables', () => {
    it('emits ORDER BY for a single PK column', () => {
      const columns = [
        column({ column_name: 'id', primary_constraints: ['users_pkey'] }),
        column({ column_name: 'name' }),
      ];

      expect(buildDefaultOrderByClause(columns)).toBe('ORDER BY id ASC');
    });

    it('quotes identifiers that require quoting (mixed case)', () => {
      const columns = [
        column({ column_name: 'userId', primary_constraints: ['t_pkey'] }),
      ];

      expect(buildDefaultOrderByClause(columns)).toBe('ORDER BY "userId" ASC');
    });

    it('emits a multi-column ORDER BY for composite primary keys', () => {
      const columns = [
        column({ column_name: 'tenant_id', primary_constraints: ['t_pkey'] }),
        column({ column_name: 'user_id', primary_constraints: ['t_pkey'] }),
        column({ column_name: 'created_at' }),
      ];

      expect(buildDefaultOrderByClause(columns)).toBe(
        'ORDER BY tenant_id ASC, user_id ASC',
      );
    });
  });

  describe('tables without a primary key', () => {
    it('falls back to the first sortable column when the first column is unsortable', () => {
      const columns = [
        column({ column_name: 'payload', data_type: 'json', udt_name: 'json' }),
        column({ column_name: 'name', data_type: 'text', udt_name: 'text' }),
      ];

      expect(buildDefaultOrderByClause(columns)).toBe(
        'ORDER BY name ASC, ctid ASC',
      );
    });

    it('skips columns whose udt_name is unsortable even if data_type looks ok', () => {
      const columns = [
        column({
          column_name: 'shape',
          data_type: 'USER-DEFINED',
          udt_name: 'polygon',
        }),
        column({ column_name: 'label', data_type: 'text', udt_name: 'text' }),
      ];

      expect(buildDefaultOrderByClause(columns)).toBe(
        'ORDER BY label ASC, ctid ASC',
      );
    });

    it('keeps jsonb sortable (only json is on the deny-list)', () => {
      const columns = [
        column({ column_name: 'meta', data_type: 'jsonb', udt_name: 'jsonb' }),
      ];

      expect(buildDefaultOrderByClause(columns)).toBe(
        'ORDER BY meta ASC, ctid ASC',
      );
    });

    it('falls back to ctid when every column is unsortable', () => {
      const columns = [
        column({ column_name: 'a', data_type: 'json', udt_name: 'json' }),
        column({ column_name: 'b', data_type: 'xml', udt_name: 'xml' }),
        column({
          column_name: 'c',
          data_type: 'tsvector',
          udt_name: 'tsvector',
        }),
        column({
          column_name: 'd',
          data_type: 'tsquery',
          udt_name: 'tsquery',
        }),
      ];

      expect(buildDefaultOrderByClause(columns)).toBe('ORDER BY ctid ASC');
    });

    it('falls back to ctid for an empty column list', () => {
      expect(buildDefaultOrderByClause([])).toBe('ORDER BY ctid ASC');
    });
  });

  describe('regular views (no ctid)', () => {
    it('uses PK columns when present', () => {
      const columns = [
        column({ column_name: 'id', primary_constraints: ['v_pkey'] }),
      ];

      expect(buildDefaultOrderByClause(columns, 'VIEW')).toBe(
        'ORDER BY id ASC',
      );
    });

    it('omits the ctid tiebreaker for the first sortable column', () => {
      const columns = [
        column({ column_name: 'payload', data_type: 'json', udt_name: 'json' }),
        column({ column_name: 'name', data_type: 'text', udt_name: 'text' }),
      ];

      expect(buildDefaultOrderByClause(columns, 'VIEW')).toBe(
        'ORDER BY name ASC',
      );
    });

    it('returns an empty clause when every column is unsortable', () => {
      const columns = [
        column({ column_name: 'a', data_type: 'json', udt_name: 'json' }),
        column({ column_name: 'b', data_type: 'xml', udt_name: 'xml' }),
      ];

      expect(buildDefaultOrderByClause(columns, 'VIEW')).toBe('');
    });

    it('returns an empty clause for an empty column list', () => {
      expect(buildDefaultOrderByClause([], 'VIEW')).toBe('');
    });
  });

  describe('foreign tables (no usable ctid)', () => {
    it('uses PK columns when present', () => {
      const columns = [
        column({ column_name: 'id', primary_constraints: ['ft_pkey'] }),
      ];

      expect(buildDefaultOrderByClause(columns, 'FOREIGN TABLE')).toBe(
        'ORDER BY id ASC',
      );
    });

    it('omits the ctid tiebreaker for the first sortable column', () => {
      const columns = [
        column({ column_name: 'name', data_type: 'text', udt_name: 'text' }),
      ];

      expect(buildDefaultOrderByClause(columns, 'FOREIGN TABLE')).toBe(
        'ORDER BY name ASC',
      );
    });

    it('returns an empty clause when every column is unsortable', () => {
      const columns = [
        column({ column_name: 'a', data_type: 'json', udt_name: 'json' }),
      ];

      expect(buildDefaultOrderByClause(columns, 'FOREIGN TABLE')).toBe('');
    });
  });

  describe('materialized views', () => {
    it('keeps the ctid tiebreaker (materialized views have ctid)', () => {
      const columns = [
        column({ column_name: 'name', data_type: 'text', udt_name: 'text' }),
      ];

      expect(buildDefaultOrderByClause(columns, 'MATERIALIZED VIEW')).toBe(
        'ORDER BY name ASC, ctid ASC',
      );
    });
  });
});
