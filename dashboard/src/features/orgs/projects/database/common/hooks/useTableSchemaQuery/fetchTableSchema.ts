import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import {
  COLUMN_DEFINITION_QUERY,
  CONSTRAINT_DEFINITION_QUERY,
} from '@/features/orgs/projects/database/common/utils/sqlTemplates';
import type { FetchTableReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type {
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  NormalizedQueryDataRow,
  QueryError,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

export type FetchTableSchemaOptions = MutationOrQueryBaseOptions;

export type FetchTableSchemaReturnType = Omit<
  FetchTableReturnType,
  'rows' | 'numberOfRows'
>;

/**
 * Fetch the schema of a table (columns and foreign key relations) without
 * fetching any row data.
 *
 * @param options - Options to use for the fetch call.
 * @returns The columns and foreign key relations of the table.
 */
export default async function fetchTableSchema({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
}: FetchTableSchemaOptions): Promise<FetchTableSchemaReturnType> {
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
          foreignKeyRelations: [],
          error: null,
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
          error: null,
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

  const foreignKeyRelations = Array.from(foreignKeyRelationMap.keys()).reduce(
    (accumulator, key) => {
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
    },
    [] as ForeignKeyRelation[],
  );

  return { columns, foreignKeyRelations, error: null };
}
