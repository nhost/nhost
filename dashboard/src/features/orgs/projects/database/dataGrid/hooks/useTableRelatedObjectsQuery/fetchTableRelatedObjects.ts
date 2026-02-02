import type {
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';

export interface FetchTableRelatedObjectsOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {
  /**
   * Table name to fetch related objects for.
   */
  table: string;
}

export interface TableConstraint {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'EXCLUSION';
  definition: string;
  columns: string[];
}

export interface TableTrigger {
  name: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  events: string[];
  functionName: string;
  functionSchema: string;
  isEnabled: boolean;
  definition: string;
}

export interface TableIndex {
  name: string;
  definition: string;
  isUnique: boolean;
  isPrimary: boolean;
  columns: string[];
}

export interface FetchTableRelatedObjectsReturnType {
  constraints: TableConstraint[];
  triggers: TableTrigger[];
  indexes: TableIndex[];
  error: string | null;
}

const CONSTRAINT_TYPE_MAP: Record<string, TableConstraint['type']> = {
  p: 'PRIMARY KEY',
  f: 'FOREIGN KEY',
  u: 'UNIQUE',
  c: 'CHECK',
  x: 'EXCLUSION',
};

/**
 * Fetch related database objects for a table (constraints, triggers, indexes).
 */
export default async function fetchTableRelatedObjects({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
}: FetchTableRelatedObjectsOptions): Promise<FetchTableRelatedObjectsReturnType> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        // Query 1: Constraints with grouped columns
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(data) FROM (
            SELECT
              con.conname AS constraint_name,
              con.contype AS constraint_type,
              pg_get_constraintdef(con.oid) AS constraint_definition,
              ARRAY_AGG(attr.attname ORDER BY ak.n) AS columns
            FROM pg_constraint con
            INNER JOIN pg_namespace nsp ON nsp.oid = con.connamespace
            CROSS JOIN LATERAL UNNEST(con.conkey) WITH ORDINALITY AS ak(k, n)
            INNER JOIN pg_attribute attr
              ON attr.attrelid = con.conrelid AND attr.attnum = ak.k
            WHERE con.conrelid = '%1$I.%2$I'::regclass
            GROUP BY con.conname, con.contype, con.oid
            ORDER BY con.contype, con.conname
          ) data`,
          schema,
          table,
        ),
        // Query 2: Triggers
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(data) FROM (
            SELECT
              trg.tgname AS trigger_name,
              CASE
                WHEN trg.tgtype::integer & 2 = 2 THEN 'BEFORE'
                WHEN trg.tgtype::integer & 2 = 0 AND trg.tgtype::integer & 64 = 64 THEN 'INSTEAD OF'
                ELSE 'AFTER'
              END AS timing,
              ARRAY_REMOVE(ARRAY[
                CASE WHEN trg.tgtype::integer & 4 = 4 THEN 'INSERT' END,
                CASE WHEN trg.tgtype::integer & 8 = 8 THEN 'DELETE' END,
                CASE WHEN trg.tgtype::integer & 16 = 16 THEN 'UPDATE' END,
                CASE WHEN trg.tgtype::integer & 32 = 32 THEN 'TRUNCATE' END
              ], NULL) AS events,
              proc.proname AS function_name,
              nsp_func.nspname AS function_schema,
              trg.tgenabled != 'D' AS is_enabled,
              pg_get_triggerdef(trg.oid) AS trigger_definition
            FROM pg_trigger trg
            JOIN pg_class cls ON cls.oid = trg.tgrelid
            JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
            JOIN pg_proc proc ON proc.oid = trg.tgfoid
            JOIN pg_namespace nsp_func ON nsp_func.oid = proc.pronamespace
            WHERE nsp.nspname = %1$L
              AND cls.relname = %2$L
              AND NOT trg.tgisinternal
            ORDER BY trg.tgname
          ) data`,
          schema,
          table,
        ),
        // Query 3: Indexes (non-constraint)
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(data) FROM (
            SELECT
              idx.relname AS index_name,
              pg_get_indexdef(idx.oid) AS index_definition,
              ix.indisunique AS is_unique,
              ix.indisprimary AS is_primary,
              ARRAY_AGG(attr.attname ORDER BY k.n) AS columns
            FROM pg_index ix
            JOIN pg_class idx ON idx.oid = ix.indexrelid
            JOIN pg_class tbl ON tbl.oid = ix.indrelid
            JOIN pg_namespace nsp ON nsp.oid = tbl.relnamespace
            CROSS JOIN LATERAL UNNEST(ix.indkey) WITH ORDINALITY AS k(attnum, n)
            JOIN pg_attribute attr ON attr.attrelid = tbl.oid AND attr.attnum = k.attnum
            WHERE nsp.nspname = %1$L
              AND tbl.relname = %2$L
              AND NOT ix.indisprimary
              AND NOT EXISTS (
                SELECT 1 FROM pg_constraint con
                WHERE con.conindid = idx.oid
              )
            GROUP BY idx.relname, idx.oid, ix.indisunique, ix.indisprimary
            ORDER BY idx.relname
          ) data`,
          schema,
          table,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });

  const responseData: QueryResult<string[]>[] | QueryError =
    await response.json();

  if (!response.ok || 'error' in responseData) {
    if ('internal' in responseData) {
      const queryError = responseData as QueryError;
      return {
        constraints: [],
        triggers: [],
        indexes: [],
        error: queryError.internal?.error?.message || 'Unknown error occurred.',
      };
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;
      return {
        constraints: [],
        triggers: [],
        indexes: [],
        error: queryError.error || 'Unknown error occurred.',
      };
    }
  }

  // Parse constraints
  const [, ...rawConstraints] = responseData[0].result;
  const constraints: TableConstraint[] = rawConstraints.map((raw) => {
    const data = JSON.parse(raw);
    return {
      name: data.constraint_name,
      type: CONSTRAINT_TYPE_MAP[data.constraint_type] || 'UNKNOWN',
      definition: data.constraint_definition,
      columns: data.columns || [],
    } as TableConstraint;
  });

  // Parse triggers
  const [, ...rawTriggers] = responseData[1].result;
  const triggers: TableTrigger[] = rawTriggers.map((raw) => {
    const data = JSON.parse(raw);
    return {
      name: data.trigger_name,
      timing: data.timing,
      events: data.events || [],
      functionName: data.function_name,
      functionSchema: data.function_schema,
      isEnabled: data.is_enabled,
      definition: data.trigger_definition,
    };
  });

  // Parse indexes
  const [, ...rawIndexes] = responseData[2].result;
  const indexes: TableIndex[] = rawIndexes.map((raw) => {
    const data = JSON.parse(raw);
    return {
      name: data.index_name,
      definition: data.index_definition,
      isUnique: data.is_unique,
      isPrimary: data.is_primary,
      columns: data.columns || [],
    };
  });

  return {
    constraints,
    triggers,
    indexes,
    error: null,
  };
}
