import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface SchemaDiagramColumn {
  schema: string;
  table: string;
  columnName: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  ordinalPosition: number;
  isPrimary: boolean;
}

export interface SchemaDiagramForeignKey {
  fromSchema: string;
  fromTable: string;
  fromColumn: string;
  toSchema: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

export interface SchemaDiagramData {
  columns: SchemaDiagramColumn[];
  foreignKeys: SchemaDiagramForeignKey[];
}

const COLUMN_QUERY = `
  SELECT row_to_json(col_data) AS data
  FROM (
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.ordinal_position,
      EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class cls ON cls.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = cls.relnamespace
        JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attnum = ANY(i.indkey)
        WHERE n.nspname = c.table_schema
          AND cls.relname = c.table_name
          AND a.attname = c.column_name
          AND i.indisprimary
      ) AS is_primary
    FROM information_schema.columns c
    WHERE c.table_schema NOT LIKE 'pg_%'
      AND c.table_schema NOT LIKE 'hdb_%'
      AND c.table_schema != 'information_schema'
  ) col_data
`;

const FOREIGN_KEY_QUERY = `
  SELECT row_to_json(fk_data) AS data
  FROM (
    SELECT
      n_from.nspname AS from_schema,
      cls_from.relname AS from_table,
      att_from.attname AS from_column,
      n_to.nspname AS to_schema,
      cls_to.relname AS to_table,
      att_to.attname AS to_column,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class cls_from ON cls_from.oid = con.conrelid
    JOIN pg_namespace n_from ON n_from.oid = cls_from.relnamespace
    JOIN pg_class cls_to ON cls_to.oid = con.confrelid
    JOIN pg_namespace n_to ON n_to.oid = cls_to.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey)  WITH ORDINALITY AS fk(attnum, ord)
    CROSS JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS rk(attnum, ord)
    JOIN pg_attribute att_from ON att_from.attrelid = con.conrelid  AND att_from.attnum = fk.attnum
    JOIN pg_attribute att_to   ON att_to.attrelid   = con.confrelid AND att_to.attnum   = rk.attnum
    WHERE con.contype = 'f'
      AND fk.ord = rk.ord
      AND n_from.nspname NOT LIKE 'pg_%'
      AND n_from.nspname NOT LIKE 'hdb_%'
      AND n_from.nspname != 'information_schema'
  ) fk_data
`;

interface RawColumn {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  ordinal_position: number;
  is_primary: boolean;
}

interface RawForeignKey {
  from_schema: string;
  from_table: string;
  from_column: string;
  to_schema: string;
  to_table: string;
  to_column: string;
  constraint_name: string;
}

export interface FetchSchemaDiagramDataArgs {
  appUrl: string;
  adminSecret: string;
  dataSource: string;
}

export default async function fetchSchemaDiagramData({
  appUrl,
  adminSecret,
  dataSource,
}: FetchSchemaDiagramDataArgs): Promise<SchemaDiagramData> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: { 'x-hasura-admin-secret': adminSecret },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(dataSource, COLUMN_QUERY, ''),
        getPreparedReadOnlyHasuraQuery(dataSource, FOREIGN_KEY_QUERY, ''),
      ],
      type: 'bulk',
      version: 1,
    }),
  });

  const responseData: QueryResult<string[]>[] | QueryError =
    await response.json();

  if (!response.ok || 'error' in responseData) {
    const queryError = responseData as QueryError;
    throw new Error(
      queryError.internal?.error?.message ||
        queryError.error ||
        'Failed to fetch schema',
    );
  }

  const [, ...rawColumns] = responseData[0].result;
  const [, ...rawForeignKeys] = responseData[1].result;

  const columns: SchemaDiagramColumn[] = rawColumns.map((raw) => {
    const row = JSON.parse(raw) as RawColumn;
    return {
      schema: row.table_schema,
      table: row.table_name,
      columnName: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === 'YES',
      ordinalPosition: row.ordinal_position,
      isPrimary: row.is_primary,
    };
  });

  const foreignKeys: SchemaDiagramForeignKey[] = rawForeignKeys.map((raw) => {
    const row = JSON.parse(raw) as RawForeignKey;
    return {
      fromSchema: row.from_schema,
      fromTable: row.from_table,
      fromColumn: row.from_column,
      toSchema: row.to_schema,
      toTable: row.to_table,
      toColumn: row.to_column,
      constraintName: row.constraint_name,
    };
  });

  return { columns, foreignKeys };
}
