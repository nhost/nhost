import type {
  ForeignKeyRelation,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

interface NormalizedTableConstraints {
  columns: NormalizedQueryDataRow[];
  foreignKeyRelations: ForeignKeyRelation[];
}

/**
 * Normalizes raw column and constraint query results for table consumers.
 *
 * @param rawColumns - Serialized column definitions.
 * @param rawConstraints - Serialized constraint definitions.
 * @param schema - Schema of the table being normalized.
 * @returns Normalized columns and their supported foreign key relations.
 */
export default function normalizeTableConstraints(
  rawColumns: string[],
  rawConstraints: string[],
  schema: string,
): NormalizedTableConstraints {
  const foreignKeyRelationMap = new Map<string, ForeignKeyRelation>();
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

      // Composite keys have a combined extracted column name that does not
      // match either single-column constraint row and are not supported here.
      if (
        foreignKeyRelation &&
        foreignKeyRelation.columnName === columnName &&
        !foreignKeyRelationMap.has(columnName)
      ) {
        foreignKeyRelationMap.set(columnName, {
          ...foreignKeyRelation,
          referencedSchema: foreignKeyRelation.referencedSchema || schema,
        });
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
        foreign_key_relation: foreignKeyRelation ?? null,
      } as NormalizedQueryDataRow;
    })
    .sort((a, b) => a.ordinal_position - b.ordinal_position);

  const foreignKeyRelations = Array.from(foreignKeyRelationMap.values()).reduce(
    (accumulator, foreignKeyRelation) => {
      const column = columns.find(
        ({ column_name }) => column_name === foreignKeyRelation.columnName,
      );

      if (!column) {
        return accumulator;
      }

      const foreignKeyWithOneToOne: ForeignKeyRelation = {
        ...foreignKeyRelation,
        oneToOne: column.is_unique || column.is_primary,
      };
      return [...accumulator, foreignKeyWithOneToOne];
    },
    [] as ForeignKeyRelation[],
  );

  return { columns, foreignKeyRelations };
}
