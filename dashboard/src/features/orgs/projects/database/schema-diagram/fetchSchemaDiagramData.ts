import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isGeneratedColumn } from '@/features/orgs/projects/database/dataGrid/utils/isGeneratedColumn';

export interface SchemaDiagramColumn {
  schema: string;
  table: string;
  columnName: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  ordinalPosition: number;
  isPrimary: boolean;
  isGenerated: boolean;
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

export interface SchemaDiagramFunctionReturnType {
  schema: string;
  name: string;
  oid?: string;
  returnType: string;
  returnsSet: boolean;
  isVolatile: boolean;
  returnSchema?: string;
  returnTable?: string;
}

export interface SchemaDiagramData {
  columns: SchemaDiagramColumn[];
  foreignKeys: SchemaDiagramForeignKey[];
  functionReturnTypes: SchemaDiagramFunctionReturnType[];
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
      c.is_generated,
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

    UNION ALL

    SELECT
      mv_n.nspname AS table_schema,
      mv_c.relname AS table_name,
      mv_a.attname AS column_name,
      pg_catalog.format_type(mv_a.atttypid, mv_a.atttypmod) AS data_type,
      mv_t.typname AS udt_name,
      CASE WHEN mv_a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
      mv_a.attnum::int AS ordinal_position,
      'NEVER' AS is_generated,
      false AS is_primary
    FROM pg_class mv_c
    JOIN pg_namespace mv_n ON mv_n.oid = mv_c.relnamespace
    JOIN pg_attribute mv_a ON mv_a.attrelid = mv_c.oid
    JOIN pg_type mv_t ON mv_t.oid = mv_a.atttypid
    WHERE mv_c.relkind = 'm'
      AND mv_a.attnum > 0
      AND NOT mv_a.attisdropped
      AND mv_n.nspname NOT LIKE 'pg_%'
      AND mv_n.nspname NOT LIKE 'hdb_%'
      AND mv_n.nspname != 'information_schema'
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

const FUNCTION_RETURN_TYPE_QUERY = `
  SELECT row_to_json(fn_data) AS data
  FROM (
    SELECT DISTINCT ON (n.nspname, p.proname)
      n.nspname AS schema,
      p.proname AS name,
      p.oid AS oid,
      pg_catalog.format_type(p.prorettype, NULL) AS return_type,
      p.proretset AS returns_set,
      p.provolatile AS provolatile,
      ret_n.nspname AS return_schema,
      ret_c.relname AS return_table
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_type  ret_t ON ret_t.oid = p.prorettype
    LEFT JOIN pg_class ret_c ON ret_c.oid = ret_t.typrelid
      AND ret_c.relkind IN ('r', 'p', 'v', 'm', 'f')
    LEFT JOIN pg_namespace ret_n ON ret_n.oid = ret_c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%'
      AND n.nspname NOT LIKE 'hdb_%'
      AND n.nspname != 'information_schema'
    ORDER BY n.nspname, p.proname, p.oid
  ) fn_data
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
  is_generated: 'ALWAYS' | 'NEVER';
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

interface RawFunctionReturnType {
  schema: string;
  name: string;
  oid: string;
  return_type: string;
  returns_set: boolean;
  provolatile: string;
  return_schema: string | null;
  return_table: string | null;
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
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          FUNCTION_RETURN_TYPE_QUERY,
          '',
        ),
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
  const [, ...rawFunctions] = responseData[2].result;

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
      isGenerated: isGeneratedColumn(row),
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

  const functionReturnTypes: SchemaDiagramFunctionReturnType[] =
    rawFunctions.map((raw) => {
      const row = JSON.parse(raw) as RawFunctionReturnType;
      return {
        schema: row.schema,
        name: row.name,
        oid: row.oid != null ? String(row.oid) : undefined,
        returnType: row.return_type,
        returnsSet: row.returns_set,
        isVolatile: row.provolatile === 'v',
        returnSchema: row.return_schema ?? undefined,
        returnTable: row.return_table ?? undefined,
      };
    });

  return { columns, foreignKeys, functionReturnTypes };
}
