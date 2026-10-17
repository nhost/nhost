import type {
  CandidateKey,
  ForeignKeyRelation,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';
import { extractForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import { formatForeignKeyColumns } from '@/features/orgs/projects/database/dataGrid/utils/formatForeignKeyColumns';

interface NormalizedTableConstraints {
  columns: NormalizedQueryDataRow[];
  foreignKeyRelations: ForeignKeyRelation[];
  candidateKeys: CandidateKey[];
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
  const candidateKeyMap = new Map<string, CandidateKey>();

  rawConstraints.forEach((rawConstraint) => {
    const constraint = JSON.parse(rawConstraint);
    const {
      column_name: columnName,
      constraint_type: constraintType,
      constraint_name: constraintName,
      constraint_definition: constraintDefinition,
      referenced_key_name: referencedKeyName,
    } = constraint;

    if (constraintType === 'f' && !foreignKeyRelationMap.has(constraintName)) {
      const foreignKeyRelation = extractForeignKeyRelation(
        constraintName,
        constraintDefinition,
      );

      if (foreignKeyRelation) {
        foreignKeyRelationMap.set(constraintName, {
          ...foreignKeyRelation,
          referencedSchema: foreignKeyRelation.referencedSchema || schema,
          referencedKeyName: referencedKeyName ?? undefined,
        });
      }
    }

    if (
      (constraintType === 'p' || constraintType === 'u') &&
      !candidateKeyMap.has(constraintName)
    ) {
      // Row order from UNNEST(CONKEY) is not reliable, so the column order is
      // taken from the constraint definition (`PRIMARY KEY (a, b)`).
      const definitionColumns = /\(([^)]*)\)/.exec(
        constraintDefinition ?? '',
      )?.[1];

      if (definitionColumns) {
        candidateKeyMap.set(constraintName, {
          name: constraintName,
          isPrimary: constraintType === 'p',
          columns: formatForeignKeyColumns(
            definitionColumns.replaceAll('"', ''),
          ),
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

  const allForeignKeyRelations = Array.from(foreignKeyRelationMap.values());

  const columns = rawColumns
    .map((rawColumn) => {
      const column = JSON.parse(rawColumn);
      const foreignKeyRelation = allForeignKeyRelations.find(
        ({ columns: relationColumns }) =>
          relationColumns.includes(column.column_name),
      );

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

  const candidateKeys = Array.from(candidateKeyMap.values());
  const candidateKeyColumnSets = [
    ...candidateKeys.map(({ columns: keyColumns }) => keyColumns),
    // A unique index without a backing constraint is invisible to the
    // constraint query, so a uniquely indexed column that belongs to no
    // constraint is a key of its own.
    ...columns
      .filter(
        ({ is_unique, unique_constraints, primary_constraints }) =>
          is_unique &&
          !unique_constraints.length &&
          !primary_constraints.length,
      )
      .map(({ column_name }) => [column_name]),
  ];

  const foreignKeyRelations = allForeignKeyRelations.reduce(
    (accumulator, foreignKeyRelation) => {
      const relationColumns = columns.filter(({ column_name }) =>
        foreignKeyRelation.columns.includes(column_name),
      );

      if (relationColumns.length !== foreignKeyRelation.columns.length) {
        return accumulator;
      }

      const foreignKeyWithOneToOne: ForeignKeyRelation = {
        ...foreignKeyRelation,
        oneToOne: computeForeignKeyOneToOne(
          foreignKeyRelation.columns,
          candidateKeyColumnSets,
        ),
      };
      return [...accumulator, foreignKeyWithOneToOne];
    },
    [] as ForeignKeyRelation[],
  );

  return {
    columns,
    foreignKeyRelations,
    candidateKeys,
  };
}
