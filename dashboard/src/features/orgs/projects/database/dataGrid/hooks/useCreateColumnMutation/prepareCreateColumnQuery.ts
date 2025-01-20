import type {
  DatabaseColumn,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { identityTypes } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import { prepareCreateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareCreateForeignKeyRelationQuery';
import { format } from 'node-pg-format';

export interface PrepareCreateColumnQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  /**
   * Data for the new column.
   */
  column: DatabaseColumn;
  /**
   * Determines whether or not foreign key generation should be enabled.
   *
   * @default true
   */
  enableForeignKeys?: boolean;
}

/**
 * Prepares SQL queries to create a column.
 *
 * @param options - Database and column information.
 * @returns SQL queries to create a column.
 */
export default function prepareCreateColumnQuery({
  dataSource,
  schema,
  table,
  column,
  enableForeignKeys = true,
}: PrepareCreateColumnQueryVariables) {
  const notNullClause =
    !column.isNullable || column.isIdentity ? format('NOT NULL') : '';
  const uniqueClause = column.isUnique ? format('UNIQUE') : '';
  let defaultClause = '';

  if (typeof column.defaultValue === 'string') {
    defaultClause = format('DEFAULT %L', column.defaultValue);
  } else if (column.defaultValue?.value && !column.isIdentity) {
    defaultClause = format(
      column.defaultValue.custom ? 'DEFAULT %L' : 'DEFAULT %s',
      column.defaultValue.value,
    );
  }

  console.log('schema, table, column', schema, table, column);

  let args: ReturnType<typeof getPreparedHasuraQuery>[] = [
    getPreparedHasuraQuery(
      dataSource,
      'ALTER TABLE %I.%I ADD %I %I %s %s %s',
      schema,
      table,
      column.name,
      column.type.value,
      defaultClause,
      notNullClause,
      uniqueClause,
    ),
  ];

  console.log('args', args);

  if (column.comment) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'COMMENT ON COLUMN %I.%I.%I is %L',
        schema,
        table,
        column.name,
        column.comment,
      ),
    );
  }

  if (identityTypes.includes(column.type.value) && column.isIdentity) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ALTER COLUMN %I ADD GENERATED BY DEFAULT AS IDENTITY',
        schema,
        table,
        column.name,
      ),
    );
  }

  if (!enableForeignKeys) {
    return args;
  }

  if (column.foreignKeyRelation) {
    args = args.concat(
      ...prepareCreateForeignKeyRelationQuery({
        dataSource,
        schema,
        table,
        foreignKeyRelation: column.foreignKeyRelation,
      }),
    );
  }

  return args;
}
