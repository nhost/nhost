import type {
  CandidateKey,
  CandidateKeyKind,
  ForeignKeyRelation,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
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
  column_ordinality?: number;
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
  /** Named primary, UNIQUE constraint, and standalone unique-index candidates. */
  candidateKeys: CandidateKey[];
  /** Loaded, editable UNIQUE constraints. */
  uniqueConstraints: UniqueConstraint[];
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
  const candidateColumns = new Map<
    string,
    {
      type: 'p' | 'u' | 'i';
      name: string;
      columns: { name: string; ordinal: number }[];
    }
  >();
  // Constraint name -> parsed foreign key, deduplicated across per-column rows.
  const foreignKeysByConstraint = new Map<string, ForeignKeyRelation>();

  constraints.forEach((constraint) => {
    const {
      column_name: columnName,
      constraint_type: constraintType,
      constraint_name: constraintName,
      constraint_definition: constraintDefinition,
      column_ordinality: columnOrdinality,
    } = constraint;

    const constraintGroupKey = `${constraintType}\0${constraintName}`;

    if (
      constraintType === 'p' ||
      constraintType === 'u' ||
      constraintType === 'i'
    ) {
      const candidate = candidateColumns.get(constraintGroupKey);

      if (candidate) {
        candidate.columns.push({
          name: columnName,
          ordinal: columnOrdinality ?? candidate.columns.length + 1,
        });
      } else {
        candidateColumns.set(constraintGroupKey, {
          type: constraintType,
          name: constraintName,
          columns: [{ name: columnName, ordinal: columnOrdinality ?? 1 }],
        });
      }
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

  const kindByType: Record<'p' | 'u' | 'i', CandidateKeyKind> = {
    p: 'primaryKey',
    u: 'uniqueConstraint',
    i: 'standaloneUniqueIndex',
  };
  const candidateKeys = Array.from(candidateColumns.values()).map(
    ({ type, name, columns }): CandidateKey => ({
      id: `${kindByType[type]}:${name}`,
      name,
      kind: kindByType[type],
      columns: [...columns]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((column) => column.name),
    }),
  );
  const uniqueConstraints = candidateKeys.flatMap(
    (candidate): UniqueConstraint[] =>
      candidate.kind === 'uniqueConstraint'
        ? [
            {
              id: candidate.id,
              originalName: candidate.name,
              name: candidate.name,
              columns: candidate.columns,
            },
          ]
        : [],
  );

  const seenColumnSets = new Set<string>();
  const constraintColumnSets = candidateKeys
    .map(({ columns }) => columns)
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
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
  };
}
