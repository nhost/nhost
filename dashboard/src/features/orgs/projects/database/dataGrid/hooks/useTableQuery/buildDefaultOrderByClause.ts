import { formatWithArray } from 'node-pg-format';
import type {
  NormalizedQueryDataRow,
  TableLikeObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_UNSORTABLE_TYPES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

/**
 * Build a default `ORDER BY` clause so that paginated reads are deterministic
 * when the user hasn't picked a sort column. Postgres returns arbitrary row
 * order without `ORDER BY`, which causes duplicated/skipped rows across
 * `LIMIT/OFFSET` pages.
 *
 * `ctid` is a system column that exists on regular tables and materialized
 * views but not on regular views. Foreign tables also lack a usable `ctid`
 * in the general case (only some FDWs like postgres_fdw expose it), so they
 * are treated the same as views. When the relation lacks `ctid`, the
 * tiebreaker/fallback is skipped — pagination ties may reshuffle, but the
 * query won't error.
 *
 * Preference order:
 *   1. All primary-key columns ascending (already unique, no tiebreaker
 *      needed).
 *   2. The first column whose type supports an ordering operator. For tables
 *      and materialized views, `ctid ASC` is appended as a tiebreaker so
 *      equal values don't reshuffle between pages.
 *   3. `ctid ASC` alone (tables / materialized views), or `''` for relations
 *      that lack `ctid`, when every column has an unsortable type.
 */
export function buildDefaultOrderByClause(
  columns: NormalizedQueryDataRow[],
  tableType?: TableLikeObjectType,
): string {
  const lackCtid = tableType === 'VIEW' || tableType === 'FOREIGN TABLE';

  const pkColumns = columns.filter(
    (column) => column.primary_constraints?.length > 0,
  );

  if (pkColumns.length > 0) {
    const pgFormatTemplate = pkColumns.map(() => '%I ASC').join(', ');
    return formatWithArray(
      `ORDER BY ${pgFormatTemplate}`,
      pkColumns.map((column) => column.column_name),
    );
  }

  const firstSortableColumn = columns.find(
    (column) =>
      !POSTGRESQL_UNSORTABLE_TYPES.includes(column.udt_name) &&
      !POSTGRESQL_UNSORTABLE_TYPES.includes(column.data_type),
  );

  if (firstSortableColumn) {
    const template = lackCtid ? `ORDER BY %I ASC` : `ORDER BY %I ASC, ctid ASC`;
    return formatWithArray(template, [firstSortableColumn.column_name]);
  }

  return lackCtid ? '' : 'ORDER BY ctid ASC';
}
