import type {
  DatabaseColumn,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPreparedHasuraQuery } from '@/features/orgs/projects/database/dataGrid/utils/hasuraQueryHelpers';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';
import { prepareCreateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareCreateForeignKeyRelationQuery';
import { prepareUpdateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareUpdateForeignKeyRelationQuery';
import { format } from 'node-pg-format';

export interface PrepareUpdateColumnQueryVariables
  extends Omit<MutationOrQueryBaseOptions, 'appUrl' | 'adminSecret'> {
  /**
   * Original column.
   */
  originalColumn: DatabaseColumn;
  /**
   * Updated column data.
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
 * Prepares SQL queries to update a column.
 *
 * @param options - Database and column information.
 * @returns SQL queries to update a column.
 */
export default function prepareUpdateColumnQuery({
  dataSource,
  schema,
  table,
  originalColumn,
  column,
  enableForeignKeys = true,
}: PrepareUpdateColumnQueryVariables) {
  let args: ReturnType<typeof getPreparedHasuraQuery>[] = [];

  if (!originalColumn) {
    return [];
  }

  if (originalColumn.type.value !== column.type.value) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT',
        schema,
        table,
        originalColumn.id,
      ),
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ALTER COLUMN %3$I TYPE %4$I USING %3$I::%4$I',
        schema,
        table,
        originalColumn.id,
        column.type.value,
      ),
    );
  }

  const { normalizedDefaultValue: normalizedOriginalDefaultValue } =
    normalizeDefaultValue(
      typeof originalColumn.defaultValue === 'string'
        ? originalColumn.defaultValue
        : originalColumn.defaultValue?.value,
    );

  const updatedDefaultValue =
    typeof column.defaultValue === 'string'
      ? column.defaultValue
      : column.defaultValue?.value || '';

  const isOriginalCustom =
    typeof originalColumn.defaultValue === 'string'
      ? true
      : originalColumn.defaultValue?.custom || false;

  const isUpdatedCustom =
    typeof column.defaultValue === 'string'
      ? true
      : column.defaultValue?.custom || false;

  if (
    normalizedOriginalDefaultValue !== updatedDefaultValue ||
    isOriginalCustom !== isUpdatedCustom
  ) {
    let defaultClause = '';

    if (typeof column.defaultValue === 'string') {
      defaultClause = format('SET DEFAULT %L', column.defaultValue);
    } else if (column.defaultValue?.value) {
      defaultClause = format(
        column.defaultValue.custom ? 'SET DEFAULT %L' : 'SET DEFAULT %s',
        column.defaultValue.value,
      );
    } else {
      defaultClause = format('DROP DEFAULT');
    }

    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ALTER COLUMN %I %s',
        schema,
        table,
        originalColumn.id,
        defaultClause,
      ),
    );
  }

  if (originalColumn.isNullable !== column.isNullable) {
    const notNullClause = !column.isNullable
      ? format('SET NOT NULL')
      : format('DROP NOT NULL');

    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ALTER COLUMN %I %s',
        schema,
        table,
        originalColumn.id,
        notNullClause,
      ),
    );
  }

  if (originalColumn.comment && !column.comment) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'COMMENT ON COLUMN %I.%I.%I IS %s',
        schema,
        table,
        originalColumn.id,
        'NULL',
      ),
    );
  }

  if (
    (!originalColumn.comment && column.comment) ||
    (originalColumn.comment &&
      column.comment &&
      originalColumn.comment !== column.comment)
  ) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'COMMENT ON COLUMN %I.%I.%I IS %L',
        schema,
        table,
        originalColumn.id,
        column.comment,
      ),
    );
  }

  if (originalColumn.isUnique && !column.isUnique) {
    const { uniqueConstraints } = originalColumn;

    args = args.concat(
      ...(uniqueConstraints || []).map((uniqueConstraint) =>
        getPreparedHasuraQuery(
          dataSource,
          'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
          schema,
          table,
          uniqueConstraint,
        ),
      ),
    );
  }

  if (!originalColumn.isUnique && column.isUnique) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE (%I)',
        schema,
        table,
        `${table}_${column.name}_unique`,
        originalColumn.id,
      ),
    );
  }

  if (originalColumn.isIdentity && !column.isIdentity) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ALTER COLUMN %I DROP IDENTITY IF EXISTS',
        schema,
        table,
        originalColumn.id,
      ),
    );
  }

  if (!originalColumn.isIdentity && column.isIdentity) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I ALTER COLUMN %I ADD GENERATED BY DEFAULT AS IDENTITY',
        schema,
        table,
        originalColumn.id,
      ),
    );
  }

  if (originalColumn.id !== column.name) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I RENAME COLUMN %I TO %I',
        schema,
        table,
        originalColumn.id,
        column.name,
      ),
    );
  }

  if (!enableForeignKeys) {
    return args;
  }

  if (originalColumn.foreignKeyRelation?.name && !column.foreignKeyRelation) {
    args = args.concat(
      getPreparedHasuraQuery(
        dataSource,
        'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
        schema,
        table,
        originalColumn.foreignKeyRelation.name,
      ),
    );
  }

  if (!originalColumn.foreignKeyRelation && column.foreignKeyRelation) {
    args = args.concat(
      ...prepareCreateForeignKeyRelationQuery({
        dataSource,
        schema,
        table,
        foreignKeyRelation: column.foreignKeyRelation,
      }),
    );
  }

  if (originalColumn.foreignKeyRelation && column.foreignKeyRelation) {
    args = args.concat(
      ...prepareUpdateForeignKeyRelationQuery({
        dataSource,
        schema,
        table,
        originalForeignKeyRelation: originalColumn.foreignKeyRelation,
        foreignKeyRelation: column.foreignKeyRelation,
      }),
    );
  }

  return args;
}
