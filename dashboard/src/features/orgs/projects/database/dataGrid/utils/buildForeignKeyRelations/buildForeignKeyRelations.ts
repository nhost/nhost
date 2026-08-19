import type {
  CandidateKey,
  CandidateKeyKind,
  CompleteKeyColumnSet,
  ForeignKeyRelation,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';
import {
  extractForeignKeyRelation,
  isCompleteForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

/** A row returned by `CONSTRAINT_DEFINITION_QUERY`. */
export interface RawTableConstraint {
  constraint_name: string;
  /** PostgreSQL constraint type, or synthetic `i` for an eligible index. */
  constraint_type: string;
  constraint_definition?: string | null;
  column_name: string;
  column_ordinality?: number;
}

export interface BuildForeignKeyRelationsResult {
  foreignKeyRelations: ForeignKeyRelation[];
  /** Deterministic per-column compatibility projection. */
  foreignKeyRelationsByColumn: Map<string, ForeignKeyRelation>;
  uniqueConstraintsByColumn: Map<string, string[]>;
  primaryConstraintsByColumn: Map<string, string[]>;
  candidateKeys: CandidateKey[];
  uniqueConstraints: UniqueConstraint[];
  constraintColumnSets: CompleteKeyColumnSet[];
}

type CandidateConstraintType = 'p' | 'u' | 'i';

interface ConstraintGroup {
  name: string;
  type: string;
  rows: RawTableConstraint[];
}

const CANDIDATE_KIND_BY_TYPE: Record<
  CandidateConstraintType,
  CandidateKeyKind
> = {
  p: 'primaryKey',
  u: 'uniqueConstraint',
  i: 'standaloneUniqueIndex',
};

const CANDIDATE_KIND_ORDER: Record<CandidateKeyKind, number> = {
  primaryKey: 0,
  uniqueConstraint: 1,
  standaloneUniqueIndex: 2,
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function appendToMap(map: Map<string, string[]>, key: string, value: string) {
  const existing = map.get(key);

  if (existing) {
    if (!existing.includes(value)) {
      existing.push(value);
      existing.sort((left, right) => left.localeCompare(right));
    }
    return;
  }

  map.set(key, [value]);
}

function groupConstraints(
  constraints: RawTableConstraint[],
): ConstraintGroup[] {
  const groups = new Map<string, ConstraintGroup>();

  constraints.forEach((constraint) => {
    if (
      !isNonEmptyString(constraint.constraint_name) ||
      !isNonEmptyString(constraint.constraint_type)
    ) {
      return;
    }

    const key = JSON.stringify([
      constraint.constraint_type,
      constraint.constraint_name,
    ]);
    const group = groups.get(key);

    if (group) {
      group.rows.push(constraint);
    } else {
      groups.set(key, {
        name: constraint.constraint_name,
        type: constraint.constraint_type,
        rows: [constraint],
      });
    }
  });

  return [...groups.values()];
}

function buildOrderedColumns(rows: RawTableConstraint[]): string[] | null {
  const columnsByOrdinality = new Map<number, string>();
  const ordinalityByColumn = new Map<string, number>();

  for (const row of rows) {
    if (
      !isNonEmptyString(row.column_name) ||
      !isPositiveInteger(row.column_ordinality)
    ) {
      return null;
    }

    const existingColumn = columnsByOrdinality.get(row.column_ordinality);
    const existingOrdinality = ordinalityByColumn.get(row.column_name);

    if (
      (existingColumn !== undefined && existingColumn !== row.column_name) ||
      (existingOrdinality !== undefined &&
        existingOrdinality !== row.column_ordinality)
    ) {
      return null;
    }

    columnsByOrdinality.set(row.column_ordinality, row.column_name);
    ordinalityByColumn.set(row.column_name, row.column_ordinality);
  }

  const orderedEntries = [...columnsByOrdinality.entries()].sort(
    ([left], [right]) => left - right,
  );

  if (
    orderedEntries.length === 0 ||
    orderedEntries.some(([ordinality], index) => ordinality !== index + 1)
  ) {
    return null;
  }

  return orderedEntries.map(([, column]) => column);
}

function compareRelations(
  left: ForeignKeyRelation,
  right: ForeignKeyRelation,
): number {
  return (
    (left.name ?? '').localeCompare(right.name ?? '') ||
    JSON.stringify(left.columns).localeCompare(JSON.stringify(right.columns)) ||
    left.referencedTable.localeCompare(right.referencedTable) ||
    JSON.stringify(left.referencedColumns).localeCompare(
      JSON.stringify(right.referencedColumns),
    )
  );
}

function buildCandidateKeys(groups: ConstraintGroup[]): CandidateKey[] {
  return groups
    .filter(
      (group): group is ConstraintGroup & { type: CandidateConstraintType } =>
        group.type === 'p' || group.type === 'u' || group.type === 'i',
    )
    .flatMap((group): CandidateKey[] => {
      const columns = buildOrderedColumns(group.rows);

      if (!columns) {
        return [];
      }

      const kind = CANDIDATE_KIND_BY_TYPE[group.type];
      return [
        {
          id: JSON.stringify([kind, group.name]),
          name: group.name,
          kind,
          columns,
        },
      ];
    })
    .sort(
      (left, right) =>
        CANDIDATE_KIND_ORDER[left.kind] - CANDIDATE_KIND_ORDER[right.kind] ||
        left.name.localeCompare(right.name),
    );
}

function buildForeignKeys(
  groups: ConstraintGroup[],
  schema: string,
): ForeignKeyRelation[] {
  return groups
    .filter((group) => group.type === 'f')
    .flatMap((group): ForeignKeyRelation[] => {
      const catalogColumns = buildOrderedColumns(group.rows);
      const definitions = new Set(
        group.rows.map((row) => row.constraint_definition),
      );

      if (
        !catalogColumns ||
        definitions.size !== 1 ||
        !isNonEmptyString(group.rows.at(0)?.constraint_definition)
      ) {
        return [];
      }

      const relation = extractForeignKeyRelation(
        group.name,
        group.rows.at(0)?.constraint_definition ?? '',
      );

      if (
        !relation ||
        relation.columns.length !== catalogColumns.length ||
        relation.columns.some(
          (column, index) => column !== catalogColumns.at(index),
        )
      ) {
        return [];
      }

      const normalizedRelation: ForeignKeyRelation = {
        ...relation,
        referencedSchema: relation.referencedSchema ?? schema,
      };

      return isCompleteForeignKeyRelation(normalizedRelation)
        ? [normalizedRelation]
        : [];
    })
    .sort(compareRelations);
}

function buildConstraintColumnSets(
  candidateKeys: CandidateKey[],
): CompleteKeyColumnSet[] {
  const seen = new Set<string>();

  return candidateKeys.flatMap(({ columns }): CompleteKeyColumnSet[] => {
    const signature = JSON.stringify([...columns].sort());

    if (seen.has(signature)) {
      return [];
    }

    seen.add(signature);
    return [[...columns]];
  });
}

/** Build deterministic complete relation and candidate-key views. */
export default function buildForeignKeyRelations(
  constraints: RawTableConstraint[],
  schema: string,
): BuildForeignKeyRelationsResult {
  const groups = groupConstraints(constraints);
  const candidateKeys = buildCandidateKeys(groups);
  const constraintColumnSets = buildConstraintColumnSets(candidateKeys);
  const uniqueConstraintsByColumn = new Map<string, string[]>();
  const primaryConstraintsByColumn = new Map<string, string[]>();

  candidateKeys.forEach((candidate) => {
    if (candidate.kind === 'primaryKey') {
      candidate.columns.forEach((column) => {
        appendToMap(primaryConstraintsByColumn, column, candidate.name);
      });
    } else if (candidate.kind === 'uniqueConstraint') {
      candidate.columns.forEach((column) => {
        appendToMap(uniqueConstraintsByColumn, column, candidate.name);
      });
    }
  });

  const uniqueConstraints = candidateKeys.flatMap(
    (candidate): UniqueConstraint[] =>
      candidate.kind === 'uniqueConstraint'
        ? [
            {
              id: candidate.id,
              originalName: candidate.name,
              name: candidate.name,
              columns: [...candidate.columns],
            },
          ]
        : [],
  );
  const foreignKeyRelations = buildForeignKeys(groups, schema).map(
    (relation): ForeignKeyRelation => ({
      ...relation,
      oneToOne: computeForeignKeyOneToOne(relation.columns, {
        constraintColumnSets,
      }),
    }),
  );
  const foreignKeyRelationsByColumn = new Map<string, ForeignKeyRelation>();

  foreignKeyRelations.forEach((relation) => {
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
