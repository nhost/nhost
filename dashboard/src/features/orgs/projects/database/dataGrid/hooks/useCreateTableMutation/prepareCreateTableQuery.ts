import type {
  DatabaseTable,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  getPreparedHasuraQuery,
  type HasuraOperation,
} from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { isNotEmptyValue } from '@/lib/utils';
import { format } from 'node-pg-format';

export interface PrepareCreateTableQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret' | 'table'> {
  /**
   * Data for the new column.
   */
  table: DatabaseTable;
}

/**
 * Prepares SQL queries to create a table.
 *
 * @param options - Database and column information.
 * @returns SQL queries to create a table.
 */
export default function prepareCreateTableQuery({
  dataSource,
  schema,
  table,
}: PrepareCreateTableQueryVariables) {
  let columnsAndConstraints = table.columns
    .map((column) => {
      const columnBase = format('%I %s', column.name, column.type.value);
      const isIdentity = table.identityColumn === column.name;

      if (isIdentity) {
        return `${columnBase} ${format('GENERATED ALWAYS AS IDENTITY')}`;
      }

      const uniqueClause = column.isUnique ? format('UNIQUE') : '';
      const notNullClause = !column.isNullable ? format('NOT NULL') : '';

      let defaultClause = '';

      if (typeof column.defaultValue === 'string') {
        defaultClause = format('DEFAULT %L', column.defaultValue);
      } else if (column.defaultValue?.value) {
        defaultClause = format(
          column.defaultValue.custom ? 'DEFAULT %L' : 'DEFAULT %s',
          column.defaultValue.value,
        );
      }

      return [columnBase, defaultClause, uniqueClause, notNullClause]
        .filter(Boolean)
        .join(' ');
    })
    .join(', ');

  if (isNotEmptyValue(table.primaryKey)) {
    columnsAndConstraints = format(
      `${columnsAndConstraints}, PRIMARY KEY (%I)`,
      table.primaryKey,
    );
  }

  if (isNotEmptyValue(table.foreignKeyRelations)) {
    columnsAndConstraints = format(
      `${columnsAndConstraints}, %s`,
      table.foreignKeyRelations
        .map((foreignKeyRelation) =>
          format(
            'FOREIGN KEY (%I) REFERENCES %I.%I (%I) ON UPDATE %s ON DELETE %s',
            foreignKeyRelation.columnName,
            foreignKeyRelation.referencedSchema || schema,
            foreignKeyRelation.referencedTable,
            foreignKeyRelation.referencedColumn,
            foreignKeyRelation.updateAction,
            foreignKeyRelation.deleteAction,
          ),
        )
        .join(', '),
    );
  }

  const hasColumnComments = table.columns.some(({ comment }) =>
    isNotEmptyValue(comment),
  );
  let columnComments: HasuraOperation[] = [];
  if (hasColumnComments) {
    columnComments = table.columns.map(({ comment, name }) =>
      getPreparedHasuraQuery(
        dataSource,
        'COMMENT ON COLUMN %I.%I.%I is %L',
        schema,
        table.name,
        name,
        comment,
      ),
    );
  }

  return [
    getPreparedHasuraQuery(
      dataSource,
      'CREATE TABLE %I.%I (%s)',
      schema,
      table.name,
      columnsAndConstraints,
    ),
    ...columnComments,
  ];
}
