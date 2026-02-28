import { formatWithArray } from 'node-pg-format';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import {
  COLUMN_DEFINITION_QUERY,
  CONSTRAINT_DEFINITION_QUERY,
} from '@/features/orgs/projects/database/common/utils/sqlTemplates';
import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { DEFAULT_ROWS_LIMIT } from '@/features/orgs/projects/database/dataGrid/constants';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  OrderBy,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import { filtersToWhere } from './filtersToWhere';

function isQueryError(payload: unknown): payload is QueryError {
  return 'error' in (payload as QueryError);
}

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
   * List of rows in the table.
   */
  rows: NormalizedQueryDataRow[];
  /**
   * Error for querying the rows
   */
  error: string | null;
  /**
   * Foreign key relations in the table.
   */
  foreignKeyRelations: ForeignKeyRelation[];
  /**
   * Total number of rows in the table.
   */
  numberOfRows: number;
  /**
   * Response metadata that usually contains information about the schema and
   * the table for which the query was run.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
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
  filters,
}: FetchTableOptions): Promise<FetchTableReturnType> {
  let limitAndOffsetClause = '';

  if (limit && offset) {
    limitAndOffsetClause = `LIMIT ${limit} OFFSET ${offset}`;
  } else if (limit) {
    limitAndOffsetClause = `LIMIT ${limit}`;
  } else {
    limitAndOffsetClause = `LIMIT ${DEFAULT_ROWS_LIMIT}`;
  }

  let orderByClause = 'ORDER BY 1';
  if (orderBy && orderBy.length > 0) {
    // Note: This part will be added to the SQL template
    const pgFormatTemplate = orderBy.map(() => '%I %s').join(' ');

    // Note: We are flattening object values so that we can pass them to the
    // formatter function as arguments
    const flattenedOrderByValues = orderBy.reduce<OrderBy[]>(
      (values, currentOrderBy) => {
        const currentValues = Object.values(currentOrderBy) as OrderBy[];
        return [...values, ...currentValues];
      },
      [],
    );

    orderByClause = formatWithArray(
      `ORDER BY ${pgFormatTemplate}`,
      flattenedOrderByValues,
    );
  }

  const whereClause = filtersToWhere(filters);

  const tableDataResponse = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          COLUMN_DEFINITION_QUERY,
          schema,
          table,
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          CONSTRAINT_DEFINITION_QUERY,
          schema,
          table,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });
  const rowDataResponse = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT ROW_TO_JSON(TABLE_DATA) FROM (SELECT * FROM %I.%I %s %s %s) TABLE_DATA`,
          schema,
          table,
          whereClause,
          orderByClause,
          limitAndOffsetClause,
        ),
        getPreparedReadOnlyHasuraQuery(
          dataSource,
          `SELECT COUNT(*) FROM %I.%I %s`,
          schema,
          table,
          whereClause,
        ),
      ],
      type: 'bulk',
      version: 1,
    }),
  });

  const responseData: QueryResult<string[]>[] | QueryError =
    await tableDataResponse.json();

  if (!tableDataResponse.ok || 'error' in responseData) {
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
          error: null,
          numberOfRows: 0,
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
          rows: [],
          error: null,
          numberOfRows: 0,
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

  const flatForeignKeyRelations = Array.from(
    foreignKeyRelationMap.keys(),
  ).reduce((accumulator, key) => {
    const value = foreignKeyRelationMap.get(key);

    if (!value) {
      return accumulator;
    }

    const parsedValue = JSON.parse(value) as ForeignKeyRelation;
    const column = columns.find(
      ({ column_name }) => column_name === parsedValue.columnName,
    )!;
    const foreignKeyWithOneToOne: ForeignKeyRelation = {
      ...parsedValue,
      oneToOne: column.is_unique || column.is_primary,
    };
    return [...accumulator, foreignKeyWithOneToOne];
  }, [] as ForeignKeyRelation[]);

  const rawData: QueryResult<string[]> | QueryError =
    await rowDataResponse.json();

  if (!rowDataResponse.ok && isQueryError(rawData)) {
    return {
      columns,
      rows: [],
      error:
        rawData.internal?.error.message ||
        'Something went wrong while fetching the table rows.',
      foreignKeyRelations: flatForeignKeyRelations,
      numberOfRows: 0,
    };
  }

  const [, ...rowData] = rawData[0].result as string[];
  const [, [rowAggregate]] = rawData[1].result as string[];

  return {
    columns,
    rows: rowData.map((row) => JSON.parse(row)) as NormalizedQueryDataRow[],
    error: null,
    foreignKeyRelations: flatForeignKeyRelations,
    numberOfRows: parseInt(rowAggregate, 10) || 0,
  };
}
