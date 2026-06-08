import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { areStrArraysEqual } from '@/lib/utils';

/**
 * A single row of `CONSTRAINT_DEFINITION_QUERY`. Composite constraints produce
 * one row per participating column (the query unnests `conkey`), and every row
 * shares the same `constraint_name` and `constraint_definition`.
 */
export interface RawTableConstraint {
  constraint_name: string;
  constraint_type: string;
  constraint_definition?: string;
  column_name: string;
}

/**
 * The subset of a parsed column we need to derive the `oneToOne` flag for
 * single-column foreign keys.
 */
export interface ForeignKeyConstraintColumn {
  column_name: string;
  is_unique?: boolean;
  is_primary?: boolean;
}

export interface BuildForeignKeyRelationsResult {
  /**
   * One entry per foreign key. Composite keys are NOT duplicated per column.
   */
  foreignKeyRelations: ForeignKeyRelation[];
  /**
   * Maps a local column name to the foreign key it participates in. A column
   * that takes part in several foreign keys keeps the first one seen.
   */
  foreignKeyRelationsByColumn: Map<string, ForeignKeyRelation>;
  /**
   * Maps a column name to the unique constraint names that include it.
   */
  uniqueConstraintsByColumn: Map<string, string[]>;
  /**
   * Maps a column name to the primary key constraint names that include it.
   */
  primaryConstraintsByColumn: Map<string, string[]>;
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
 * foreign key relations plus the unique/primary constraint lookups used to
 * enrich columns.
 *
 * Both single-column and composite foreign keys are supported: a composite key
 * is deduplicated across its per-column rows into a single relation whose
 * `columns`/`referencedColumns` arrays hold every participating column.
 *
 * @param constraints - Parsed constraint rows (one per participating column).
 * @param columns - Parsed columns of the table, used to derive `oneToOne` for
 *   single-column foreign keys.
 * @param schema - Schema of the table, used as the referenced-schema fallback.
 */
export default function buildForeignKeyRelations(
  constraints: RawTableConstraint[],
  columns: ForeignKeyConstraintColumn[],
  schema: string,
): BuildForeignKeyRelationsResult {
  const uniqueConstraintsByColumn = new Map<string, string[]>();
  const primaryConstraintsByColumn = new Map<string, string[]>();
  // Constraint name -> the columns it spans, used to decide whether a foreign
  // key is one-to-one (its local columns are covered by a unique/PK set).
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

    const spanned = constraintColumns.get(constraintName);

    if (spanned) {
      spanned.columns.push(columnName);
    } else {
      constraintColumns.set(constraintName, {
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

  const uniqueColumnSets = Array.from(constraintColumns.values())
    .filter(({ type }) => type === 'p' || type === 'u')
    .map(({ columns: constraintColumnNames }) => constraintColumnNames);

  const columnsByName = new Map(
    columns.map((column) => [column.column_name, column]),
  );

  function isOneToOne(foreignKeyColumns: string[]): boolean {
    if (foreignKeyColumns.length === 1) {
      const column = columnsByName.get(foreignKeyColumns[0]);

      if (column?.is_unique || column?.is_primary) {
        return true;
      }
    }

    return uniqueColumnSets.some((columnSet) =>
      areStrArraysEqual(columnSet, foreignKeyColumns),
    );
  }

  const foreignKeyRelations: ForeignKeyRelation[] = [];
  const foreignKeyRelationsByColumn = new Map<string, ForeignKeyRelation>();

  foreignKeysByConstraint.forEach((foreignKeyRelation) => {
    const relation: ForeignKeyRelation = {
      ...foreignKeyRelation,
      oneToOne: isOneToOne(foreignKeyRelation.columns),
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
  };
}
