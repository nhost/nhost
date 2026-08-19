import { format } from 'node-pg-format';
import {
  getPreparedHasuraQuery,
  type HasuraOperation,
} from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type {
  DatabaseTable,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getSingularForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { isNotEmptyValue } from '@/lib/utils';

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
      const columnBase = format('%I %s', column.name, column.type);
      const isIdentity = table.identityColumn === column.name;

      if (isIdentity) {
        return `${columnBase} ${format('GENERATED ALWAYS AS IDENTITY')}`;
      }

      const uniqueClause = column.isUnique ? format('UNIQUE') : '';
      const notNullClause = !column.isNullable ? format('NOT NULL') : '';

      let defaultClause = '';

      if (column.defaultValue) {
        defaultClause = format('DEFAULT %s', column.defaultValue);
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
    const singularForeignKeys = table.foreignKeyRelations.flatMap(
      (foreignKeyRelation): string[] => {
        const singularRelation =
          getSingularForeignKeyRelation(foreignKeyRelation);

        return singularRelation
          ? [
              format(
                'FOREIGN KEY (%I) REFERENCES %I.%I (%I) ON UPDATE %s ON DELETE %s',
                singularRelation.localColumn,
                foreignKeyRelation.referencedSchema || schema,
                foreignKeyRelation.referencedTable,
                singularRelation.remoteColumn,
                foreignKeyRelation.updateAction,
                foreignKeyRelation.deleteAction,
              ),
            ]
          : [];
      },
    );

    if (singularForeignKeys.length > 0) {
      columnsAndConstraints = format(
        `${columnsAndConstraints}, %s`,
        singularForeignKeys.join(', '),
      );
    }
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
