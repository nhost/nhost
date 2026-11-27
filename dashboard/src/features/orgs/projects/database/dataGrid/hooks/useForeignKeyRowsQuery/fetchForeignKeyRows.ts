import { format } from 'node-pg-format';
import type {
  MutationOrQueryBaseOptions,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getBaseType } from '@/features/orgs/projects/database/dataGrid/utils/getBaseType';
import { isArray } from '@/features/orgs/projects/database/dataGrid/utils/isArray';

export interface PickerColumn {
  name: string;
  type: string;
}

export interface ForeignKeyRow {
  values: string[];
  label: string;
}

export const FOREIGN_KEY_ROWS_LIMIT = 20;

const LABEL_COLUMNS = ['name', 'title', 'display_name', 'displayName', 'email'];
const TEXT_TYPES = [
  'text',
  'character varying',
  'character',
  'bpchar',
  'citext',
];

export function getPickerLabelColumn(columns: PickerColumn[]) {
  return LABEL_COLUMNS.find((name) =>
    columns.some(
      (column) =>
        column.name === name &&
        !isArray(column.type) &&
        TEXT_TYPES.includes(getBaseType(column.type)),
    ),
  );
}

export function prepareForeignKeyRowsSql({
  schema,
  table,
  columns,
  referencedColumns,
  search,
}: {
  schema: string;
  table: string;
  columns: PickerColumn[];
  referencedColumns: string[];
  search: string;
}) {
  const labelColumn = getPickerLabelColumn(columns);
  const keys = referencedColumns.map((name) => {
    const column = columns.find((item) => item.name === name);
    if (!column) {
      throw new Error('Referenced columns are unavailable.');
    }
    return column;
  });
  const projection = keys.map((column, index) =>
    isArray(column.type)
      ? format('to_json(%I)::text AS %I', column.name, `key_${index}`)
      : format('%I::text AS %I', column.name, `key_${index}`),
  );
  if (labelColumn) {
    projection.push(format('left(%I::text, 160) AS label', labelColumn));
  }

  const term = search.trim();
  const conditions: string[] = [];
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    if (labelColumn) {
      conditions.push(format('%I::text ILIKE %L', labelColumn, pattern));
    }
    for (const column of keys) {
      const type = getBaseType(column.type);
      if (!isArray(column.type) && TEXT_TYPES.includes(type)) {
        conditions.push(format('%I::text ILIKE %L', column.name, pattern));
      } else if (
        !isArray(column.type) &&
        [
          'smallint',
          'integer',
          'bigint',
          'numeric',
          'decimal',
          'real',
          'double precision',
        ].includes(type)
      ) {
        if (/^[+-]?\d+(\.\d+)?$/.test(term)) {
          conditions.push(format('%I = %L::numeric', column.name, term));
        }
      } else if (!isArray(column.type) && type === 'uuid') {
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            term,
          )
        ) {
          conditions.push(format('%I = %L::uuid', column.name, term));
        }
      } else {
        conditions.push(format('%I::text = %L', column.name, term));
      }
    }
  }

  const notNull = keys.map((column) => format('%I IS NOT NULL', column.name));
  if (term) {
    notNull.push(conditions.length ? `(${conditions.join(' OR ')})` : 'FALSE');
  }
  return format(
    'SELECT row_to_json(picker_row) FROM (SELECT %s FROM %I.%I WHERE %s ORDER BY %s LIMIT %s) picker_row',
    projection.join(', '),
    schema,
    table,
    notNull.join(' AND '),
    keys.map((column) => format('%I ASC', column.name)).join(', '),
    FOREIGN_KEY_ROWS_LIMIT + 1,
  );
}

interface FetchForeignKeyRowsOptions extends MutationOrQueryBaseOptions {
  columns: PickerColumn[];
  referencedColumns: string[];
  search: string;
  signal?: AbortSignal;
}

export async function fetchForeignKeyRows({
  appUrl,
  adminSecret,
  dataSource,
  signal,
  ...options
}: FetchForeignKeyRowsOptions) {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    signal,
    headers: { 'x-hasura-admin-secret': adminSecret },
    body: JSON.stringify({
      type: 'run_sql',
      args: {
        source: dataSource,
        read_only: true,
        cascade: false,
        sql: prepareForeignKeyRowsSql(options),
      },
    }),
  });
  const payload: QueryResult<string[][]> = await response.json();
  if (!response.ok || !Array.isArray(payload.result)) {
    throw new Error(
      'Unable to load linked rows. You can still enter values manually.',
    );
  }
  const rows = payload.result.slice(1).map(([raw]) => {
    let row: Record<string, string | null>;
    try {
      row = JSON.parse(raw);
      if (
        !row ||
        options.referencedColumns.some(
          (_, index) => typeof row[`key_${index}`] !== 'string',
        )
      ) {
        throw new Error('Invalid linked row.');
      }
    } catch {
      throw new Error('Unable to load linked rows.');
    }
    return {
      values: options.referencedColumns.map((_, index) => row[`key_${index}`]!),
      label: row.label?.trim() ?? '',
    };
  });
  return {
    rows: rows.slice(0, FOREIGN_KEY_ROWS_LIMIT),
    hasMore: rows.length > FOREIGN_KEY_ROWS_LIMIT,
  };
}
