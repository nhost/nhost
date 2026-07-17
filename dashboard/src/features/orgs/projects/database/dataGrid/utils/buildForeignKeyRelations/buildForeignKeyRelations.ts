import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';
import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

/**
 * A single row of `CONSTRAINT_DEFINITION_QUERY`. Composite constraints produce
 * one row per participating column (the query unnests `conkey`), and every row
 * shares the same `constraint_name` and `constraint_definition`.
 */
export interface RawTableConstraint {
  constraint_name: string;
  /** PostgreSQL constraint type, or synthetic `i` for an eligible unique index. */
  constraint_type: string;
  constraint_definition?: string | null;
  column_name: string;
}

export interface BuildForeignKeyRelationsResult {
  /** One entry per foreign key; composite keys are not duplicated per column. */
  foreignKeyRelations: ForeignKeyRelation[];
  /** Local column -> its foreign key; a column in several keys keeps the first one seen. */
  foreignKeyRelationsByColumn: Map<string, ForeignKeyRelation>;
  /** Column name -> the unique constraint names that include it. */
  uniqueConstraintsByColumn: Map<string, string[]>;
  /** Column name -> the primary key constraint names that include it. */
  primaryConstraintsByColumn: Map<string, string[]>;
  /** Complete primary key, unique-constraint, and eligible unique-index sets. */
  constraintColumnSets: string[][];
}

function appendToMap(map: Map<string, string[]>, key: string, value: string) {
  const existing = map.get(key);

  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

/**
 * Parses the rows returned by `CONSTRAINT_DEFINITION_QUERY` into structured
 * foreign key relations plus the unique / primary key constraint lookups.
 * Composite foreign keys are deduplicated across their per-column rows into a
 * single relation whose `columns`/`referencedColumns` hold every column.
 */
export default function buildForeignKeyRelations(
  constraints: RawTableConstraint[],
  schema: string,
): BuildForeignKeyRelationsResult {
  const uniqueConstraintsByColumn = new Map<string, string[]>();
  const primaryConstraintsByColumn = new Map<string, string[]>();
  // Constraint/index kind and name -> the columns it spans, used to decide
  // whether a foreign key is one-to-one.
  const constraintColumns = new Map<
    string,
    { type: string; columns: string[] }
  >();
  // Constraint name -> parsed foreign key, deduplicated across per-column rows.
  const foreignKeysByConstraint = new Map<string, ForeignKeyRelation>();

  constraints.forEach((constraint) => {
    const {
      column_name: columnName,
      constraint_type: constraintType,
      constraint_name: constraintName,
      constraint_definition: constraintDefinition,
    } = constraint;

    const constraintGroupKey = `${constraintType}\0${constraintName}`;
    const spanned = constraintColumns.get(constraintGroupKey);

    if (spanned) {
      spanned.columns.push(columnName);
    } else {
      constraintColumns.set(constraintGroupKey, {
        type: constraintType,
        columns: [columnName],
      });
    }

    if (
      constraintType === 'f' &&
      !foreignKeysByConstraint.has(constraintName)
    ) {
      const foreignKeyRelation = extractForeignKeyRelation(
        constraintName,
        constraintDefinition ?? '',
      );

      if (foreignKeyRelation) {
        foreignKeysByConstraint.set(constraintName, {
          ...foreignKeyRelation,
          referencedSchema: foreignKeyRelation.referencedSchema || schema,
        });
      }
    }

    if (constraintType === 'p') {
      appendToMap(primaryConstraintsByColumn, columnName, constraintName);
    }

    if (constraintType === 'u') {
      appendToMap(uniqueConstraintsByColumn, columnName, constraintName);
    }
  });

  const seenColumnSets = new Set<string>();
  const constraintColumnSets = Array.from(constraintColumns.values())
    .filter(({ type }) => type === 'p' || type === 'u' || type === 'i')
    .map(({ columns: constraintColumnNames }) => constraintColumnNames)
    .filter((constraintColumnNames) => {
      const signature = JSON.stringify(
        [...constraintColumnNames].sort((left, right) =>
          left.localeCompare(right),
        ),
      );

      if (seenColumnSets.has(signature)) {
        return false;
      }

      seenColumnSets.add(signature);
      return true;
    });

  const foreignKeyRelations: ForeignKeyRelation[] = [];
  const foreignKeyRelationsByColumn = new Map<string, ForeignKeyRelation>();

  foreignKeysByConstraint.forEach((foreignKeyRelation) => {
    const relation: ForeignKeyRelation = {
      ...foreignKeyRelation,
      oneToOne: computeForeignKeyOneToOne(foreignKeyRelation.columns, {
        constraintColumnSets,
      }),
    };

    foreignKeyRelations.push(relation);

    relation.columns.forEach((column) => {
      if (!foreignKeyRelationsByColumn.has(column)) {
        foreignKeyRelationsByColumn.set(column, relation);
      }
    });
  });

  return {
    foreignKeyRelations,
    foreignKeyRelationsByColumn,
    uniqueConstraintsByColumn,
    primaryConstraintsByColumn,
    constraintColumnSets,
  };
}
