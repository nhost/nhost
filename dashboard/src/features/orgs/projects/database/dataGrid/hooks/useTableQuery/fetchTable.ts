import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  OrderBy,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { extractForeignKeyRelation } from '@/features/database/dataGrid/utils/extractForeignKeyRelation';
import { getPreparedReadOnlyHasuraQuery } from '@/features/database/dataGrid/utils/hasuraQueryHelpers';
import { POSTGRESQL_ERROR_CODES } from '@/features/database/dataGrid/utils/postgresqlConstants';
import { formatWithArray } from 'node-pg-format';

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
}

export interface FetchTableReturnType {
  /**
   * List of columns in the table.
   */
  columns?: NormalizedQueryDataRow[];
  /**
   * List of rows in the table.
   */
  rows?: NormalizedQueryDataRow[];
  /**
   * Foreign key relations in the table.
   */
  foreignKeyRelations?: ForeignKeyRelation[];
  /**
   * Total number of rows in the table.
   */
  numberOfRows?: number;
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
  limit,
  offset,
  orderBy,
  preventRowFetching,
}: FetchTableOptions): Promise<FetchTableReturnType> {
  let limitAndOffsetClause = '';

  if (preventRowFetching) {
    limitAndOffsetClause = `LIMIT 0`;
  } else if (limit && offset) {
    limitAndOffsetClause = `LIMIT ${limit} OFFSET ${offset}`;
  } else if (limit) {
    limitAndOffsetClause = `LIMIT ${limit}`;
  }

  let orderByClause = 'ORDER BY 1';

  if (orderBy && orderBy.length > 0) {
    // Note: This part will be added to the SQL template
    const pgFormatTemplate = orderBy.map(() => '%I %s').join(' ');

    // Note: We are flattening object values so that we can pass them to the
    // formatter function as arguments
    const flattenedOrderByValues = orderBy.reduce(
      (values, currentOrderBy) => [...values, ...Object.values(currentOrderBy)],
      [],
    );

    orderByClause = formatWithArray(
      `ORDER BY ${pgFormatTemplate}`,
      flattenedOrderByValues,
    );
  }

  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(TABLE_DATA) FROM (\
            SELECT *,\
              EXISTS (\
                SELECT NSP.NSPNAME, CLS.RELNAME, ATTR.ATTNAME\
                FROM PG_INDEX IND\
                JOIN PG_CLASS CLS ON CLS.OID = IND.INDRELID\
                JOIN PG_ATTRIBUTE ATTR ON ATTR.ATTRELID = CLS.OID\
                AND ATTR.ATTNUM = ANY(IND.INDKEY)\
                JOIN PG_NAMESPACE NSP ON NSP.OID = CLS.RELNAMESPACE\
                WHERE NSPNAME = %1$L AND RELNAME = %2$L AND ATTR.ATTNAME = COLS.COLUMN_NAME AND INDISPRIMARY\
              ) AS IS_PRIMARY,\
              EXISTS (\
                SELECT NSP.NSPNAME, CLS.RELNAME, ATTR.ATTNAME\
                FROM PG_INDEX IND\
                JOIN PG_CLASS CLS ON CLS.OID = IND.INDRELID\
                JOIN PG_ATTRIBUTE ATTR ON ATTR.ATTRELID = CLS.OID\
                AND ATTR.ATTNUM = ANY(IND.INDKEY)\
                JOIN PG_NAMESPACE NSP ON NSP.OID = CLS.RELNAMESPACE\
                WHERE NSPNAME = %1$L AND RELNAME = %2$L AND ATTR.ATTNAME = COLS.COLUMN_NAME AND INDISUNIQUE\
              ) AS IS_UNIQUE,\
              (\
                SELECT PG_CATALOG.COL_DESCRIPTION(CLS.OID, COLS.ORDINAL_POSITION::INT)\
                FROM PG_CATALOG.PG_CLASS CLS\
                WHERE CLS.OID = (SELECT '%1$I.%2$I'::REGCLASS::OID) AND CLS.RELNAME = COLS.TABLE_NAME\
              ) AS COLUMN_COMMENT\
            FROM INFORMATION_SCHEMA.COLUMNS COLS\
            WHERE TABLE_SCHEMA = %1$L AND TABLE_NAME = %2$L\
          ) TABLE_DATA`,
          schema,
          table,
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(TABLE_DATA) FROM (SELECT * FROM %I.%I %s %s) TABLE_DATA`,
          schema,
          table,
          orderByClause,
          limitAndOffsetClause,
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
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT COUNT(*) FROM %I.%I`,
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
          rows: [],
          numberOfRows: 0,
          metadata: { schema, table, schemaNotFound, tableNotFound },
        };
      }

      if (
        queryError.internal?.error?.status_code ===
        POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND
      ) {
        return {
          columns: [],
          rows: [],
          numberOfRows: 0,
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
  const [, ...rawData] = responseData[1].result;
  const [, ...rawConstraints] = responseData[2].result;
  const [, ...[rawAggregate]] = responseData[3].result;

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
            referencedSchema: foreignKeyRelation.referencedSchema || schema,
          }),
        );
      }
    }

    if (constraintType === 'p') {
      if (primaryKeyConstraintMap.has(columnName)) {
        primaryKeyConstraintMap.set(columnName, [
          ...primaryKeyConstraintMap.get(columnName),
          constraintName,
        ]);
      } else {
        primaryKeyConstraintMap.set(columnName, [constraintName]);
      }
    }

    if (constraintType === 'u') {
      if (uniqueKeyConstraintMap.has(columnName)) {
        uniqueKeyConstraintMap.set(columnName, [
          ...uniqueKeyConstraintMap.get(columnName),
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
    rows: rawData.map((rawRow) =>
      JSON.parse(rawRow),
    ) as NormalizedQueryDataRow[],
    foreignKeyRelations: flatForeignKeyRelations,
    numberOfRows: rawAggregate ? parseInt(rawAggregate, 10) : 0,
  };
}
