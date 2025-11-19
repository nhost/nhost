import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridFilterProvider';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  OrderBy,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

export interface FetchTableOptions extends MutationOrQueryBaseOptions {
  /**
   * Limit of rows to fetch.
   */
  limit?: number;
  /**
   * Offset of rows to fetch.
   */
  offset?: number;
  /**
   * Ordering configuration.
   *
   * @default []
   */
  orderBy?: OrderBy[];
  /**
   * Determines whether the query should fetch the rows or not.
   */
  preventRowFetching?: boolean;
  /**
   * Filtering configuration.
   *
   * @default []
   */
  filters?: DataGridFilter[];
}

export interface FetchTableReturnType {
  /**
   * List of columns in the table.
   */
  columns: NormalizedQueryDataRow[];
  /**
   * Foreign key relations in the table.
   */
  foreignKeyRelations: ForeignKeyRelation[];
  /**
   * Response metadata that usually contains information about the schema and
   * the table for which the query was run.
   */
  metadata?: Record<string, any>;
}

/**
 * Fetch the available columns and rows of a table.
 *
 * @param options - Options to use for the fetch call.
 * @returns The available columns and rows in the table.
 */
export default async function fetchTable({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
}: FetchTableOptions): Promise<FetchTableReturnType> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `
            SELECT ROW_TO_JSON(TABLE_DATA) FROM (
                SELECT *,
                    PG_CATALOG.FORMAT_TYPE(
                        (SELECT ATTTYPID FROM PG_ATTRIBUTE
                         WHERE ATTRELID = (SELECT OID FROM PG_CLASS WHERE RELNAME = %2$L AND RELNAMESPACE = (SELECT OID FROM PG_NAMESPACE WHERE NSPNAME = %1$L))
                         AND ATTNAME = COLS.COLUMN_NAME),
                        (SELECT ATTTYPMOD FROM PG_ATTRIBUTE
                         WHERE ATTRELID = (SELECT OID FROM PG_CLASS WHERE RELNAME = %2$L AND RELNAMESPACE = (SELECT OID FROM PG_NAMESPACE WHERE NSPNAME = %1$L))
                         AND ATTNAME = COLS.COLUMN_NAME)
                    ) AS FULL_DATA_TYPE,
                    EXISTS (
                        SELECT NSP.NSPNAME, CLS.RELNAME, ATTR.ATTNAME
                        FROM PG_INDEX IND
                        JOIN PG_CLASS CLS ON CLS.OID = IND.INDRELID
                        JOIN PG_ATTRIBUTE ATTR ON ATTR.ATTRELID = CLS.OID AND ATTR.ATTNUM = ANY(IND.INDKEY)
                        JOIN PG_NAMESPACE NSP ON NSP.OID = CLS.RELNAMESPACE
                        WHERE NSPNAME = %1$L AND RELNAME = %2$L AND ATTR.ATTNAME = COLS.COLUMN_NAME AND INDISPRIMARY
                    ) AS IS_PRIMARY,
                    EXISTS (
                        SELECT NSP.NSPNAME, CLS.RELNAME, ATTR.ATTNAME
                        FROM PG_INDEX IND
                        JOIN PG_CLASS CLS ON CLS.OID = IND.INDRELID
                        JOIN PG_ATTRIBUTE ATTR ON ATTR.ATTRELID = CLS.OID AND ATTR.ATTNUM = ANY(IND.INDKEY)
                        JOIN PG_NAMESPACE NSP ON NSP.OID = CLS.RELNAMESPACE
                        WHERE NSPNAME = %1$L AND RELNAME = %2$L AND ATTR.ATTNAME = COLS.COLUMN_NAME AND INDISUNIQUE
                    ) AS IS_UNIQUE,
                    (
                        SELECT PG_CATALOG.COL_DESCRIPTION(CLS.OID, COLS.ORDINAL_POSITION::INT)
                        FROM PG_CATALOG.PG_CLASS CLS
                        WHERE CLS.OID = (SELECT '%1$I.%2$I'::REGCLASS::OID) AND CLS.RELNAME = COLS.TABLE_NAME
                    ) AS COLUMN_COMMENT
                FROM INFORMATION_SCHEMA.COLUMNS COLS
                WHERE TABLE_SCHEMA = %1$L AND TABLE_NAME = %2$L
            ) TABLE_DATA;
          `,
          schema,
          table,
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(TABLE_DATA) FROM (\
            SELECT CON.CONNAME AS CONSTRAINT_NAME, CON.CONTYPE AS CONSTRAINT_TYPE, PG_GET_CONSTRAINTDEF(CON.OID) AS CONSTRAINT_DEFINITION, ATTR.ATTNAME AS COLUMN_NAME\
            FROM PG_CONSTRAINT CON
            INNER JOIN PG_NAMESPACE NSP
              ON NSP.OID = CON.CONNAMESPACE
            CROSS JOIN LATERAL UNNEST(CON.CONKEY) AK(K)
            INNER JOIN PG_ATTRIBUTE ATTR
              ON ATTR.ATTRELID = CON.CONRELID
              AND ATTR.ATTNUM = AK.K
            WHERE CON.CONRELID = '%1$I.%2$I'::REGCLASS
            ORDER BY CON.CONTYPE
          ) TABLE_DATA`,
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
      const schemaNotFound =
        POSTGRESQL_ERROR_CODES.SCHEMA_NOT_FOUND ===
        queryError.internal?.error?.status_code;

      const tableNotFound =
        POSTGRESQL_ERROR_CODES.TABLE_NOT_FOUND ===
        queryError.internal?.error?.status_code;

      if (schemaNotFound || tableNotFound) {
        return {
          columns: [],
          foreignKeyRelations: [],
          metadata: { schema, table, schemaNotFound, tableNotFound },
        };
      }

      if (
        queryError.internal?.error?.status_code ===
        POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND
      ) {
        return {
          columns: [],
          foreignKeyRelations: [],
          metadata: { schema, table, columnsNotFound: true },
        };
      }

      throw new Error(queryError.internal?.error?.message);
    }

    if ('error' in responseData) {
      const queryError = responseData as QueryError;
      throw new Error(queryError.error);
    }
  }

  const [, ...rawColumns] = responseData[0].result;
  const [, ...rawConstraints] = responseData[1].result;

  const foreignKeyRelationMap = new Map<string, string>();
  const uniqueKeyConstraintMap = new Map<string, string[]>();
  const primaryKeyConstraintMap = new Map<string, string[]>();

  rawConstraints.forEach((rawConstraint) => {
    const constraint = JSON.parse(rawConstraint);
    const {
      column_name: columnName,
      constraint_type: constraintType,
      constraint_name: constraintName,
    } = constraint;

    if (constraintType === 'f') {
      const { constraint_definition: constraintDefinition } = constraint;
      const foreignKeyRelation = extractForeignKeyRelation(
        constraintName,
        constraintDefinition,
      );

      if (!foreignKeyRelationMap.has(columnName)) {
        foreignKeyRelationMap.set(
          columnName,
          JSON.stringify({
            ...foreignKeyRelation,
            referencedSchema: foreignKeyRelation?.referencedSchema || schema,
          }),
        );
      }
    }

    if (constraintType === 'p') {
      if (primaryKeyConstraintMap.has(columnName)) {
        primaryKeyConstraintMap.set(columnName, [
          ...primaryKeyConstraintMap.get(columnName)!,
          constraintName,
        ]);
      } else {
        primaryKeyConstraintMap.set(columnName, [constraintName]);
      }
    }

    if (constraintType === 'u') {
      if (uniqueKeyConstraintMap.has(columnName)) {
        uniqueKeyConstraintMap.set(columnName, [
          ...uniqueKeyConstraintMap.get(columnName)!,
          constraintName,
        ]);
      } else {
        uniqueKeyConstraintMap.set(columnName, [constraintName]);
      }
    }
  });

  const flatForeignKeyRelations = Array.from(
    foreignKeyRelationMap.keys(),
  ).reduce((accumulator, key) => {
    const value = foreignKeyRelationMap.get(key);

    if (!value) {
      return accumulator;
    }

    return [...accumulator, JSON.parse(value) as ForeignKeyRelation];
  }, [] as ForeignKeyRelation[]);

  const columns = rawColumns
    .map((rawColumn) => {
      const column = JSON.parse(rawColumn);
      const foreignKeyRelation = foreignKeyRelationMap.get(column.column_name);

      return {
        ...column,
        unique_constraints:
          uniqueKeyConstraintMap.get(column.column_name) || [],
        primary_constraints:
          primaryKeyConstraintMap.get(column.column_name) || [],
        foreign_key_relation: foreignKeyRelation
          ? JSON.parse(foreignKeyRelation)
          : null,
      } as NormalizedQueryDataRow;
    })
    .sort((a, b) => a.ordinal_position - b.ordinal_position);
  return {
    columns,
    foreignKeyRelations: flatForeignKeyRelations,
  };
}
