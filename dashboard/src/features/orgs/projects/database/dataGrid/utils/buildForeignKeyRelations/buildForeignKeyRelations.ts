import type {
  CandidateKey,
  CandidateKeyKind,
  CompleteKeyColumnSet,
  ForeignKeyRelation,
  PostgresReferentialAction,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';

/** A row returned by `CONSTRAINT_DEFINITION_QUERY`. */
export interface RawTableConstraint {
  constraint_name: string;
  /** PostgreSQL constraint type, or synthetic `i` for an eligible index. */
  constraint_type: string;
  column_name: string;
  column_ordinality?: number;
  is_referenceable?: boolean;
  nulls_not_distinct?: boolean;
  referenced_schema?: string | null;
  referenced_table?: string | null;
  referenced_column_name?: string | null;
  update_action_code?: string | null;
  delete_action_code?: string | null;
}

export interface BuildForeignKeyRelationsResult {
  foreignKeyRelations: ForeignKeyRelation[];
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

interface DeclaredConstraint {
  name: string;
  type: 'p' | 'u';
  columns: string[];
  nullsNotDistinct: boolean;
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

const REFERENTIAL_ACTION_BY_CODE: Record<string, PostgresReferentialAction> = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
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

function buildOrderedValues(
  rows: RawTableConstraint[],
  selectValue: (row: RawTableConstraint) => unknown,
): string[] | null {
  const valuesByOrdinality = new Map<number, string>();
  const ordinalityByValue = new Map<string, number>();

  for (const row of rows) {
    const value = selectValue(row);
    if (!isNonEmptyString(value) || !isPositiveInteger(row.column_ordinality)) {
      return null;
    }

    const existingValue = valuesByOrdinality.get(row.column_ordinality);
    const existingOrdinality = ordinalityByValue.get(value);

    if (
      (existingValue !== undefined && existingValue !== value) ||
      (existingOrdinality !== undefined &&
        existingOrdinality !== row.column_ordinality)
    ) {
      return null;
    }

    valuesByOrdinality.set(row.column_ordinality, value);
    ordinalityByValue.set(value, row.column_ordinality);
  }

  const orderedEntries = [...valuesByOrdinality.entries()].sort(
    ([left], [right]) => left - right,
  );

  if (
    orderedEntries.length === 0 ||
    orderedEntries.some(([ordinality], index) => ordinality !== index + 1)
  ) {
    return null;
  }

  return orderedEntries.map(([, value]) => value);
}

function buildOrderedColumns(rows: RawTableConstraint[]): string[] | null {
  return buildOrderedValues(rows, (row) => row.column_name);
}

function readConsistentString(
  rows: RawTableConstraint[],
  selectValue: (row: RawTableConstraint) => unknown,
): string | null {
  const values = new Set(rows.map(selectValue));

  if (values.size !== 1) {
    return null;
  }

  const value = values.values().next().value;
  return isNonEmptyString(value) ? value : null;
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
        (group.type === 'p' || group.type === 'u' || group.type === 'i') &&
        group.rows.every((row) => row.is_referenceable !== false),
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

function buildDeclaredConstraints(
  groups: ConstraintGroup[],
): DeclaredConstraint[] {
  return groups
    .filter(
      (group): group is ConstraintGroup & { type: 'p' | 'u' } =>
        group.type === 'p' || group.type === 'u',
    )
    .flatMap((group): DeclaredConstraint[] => {
      const columns = buildOrderedColumns(group.rows);

      return columns
        ? [
            {
              name: group.name,
              type: group.type,
              columns,
              nullsNotDistinct: group.rows.every(
                (row) => row.nulls_not_distinct === true,
              ),
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.type.localeCompare(right.type) ||
        left.name.localeCompare(right.name),
    );
}

function buildForeignKeys(groups: ConstraintGroup[]): ForeignKeyRelation[] {
  return groups
    .filter((group) => group.type === 'f')
    .flatMap((group): ForeignKeyRelation[] => {
      const columns = buildOrderedColumns(group.rows);
      const referencedColumns = buildOrderedValues(
        group.rows,
        (row) => row.referenced_column_name,
      );
      const referencedSchema = readConsistentString(
        group.rows,
        (row) => row.referenced_schema,
      );
      const referencedTable = readConsistentString(
        group.rows,
        (row) => row.referenced_table,
      );
      const updateActionCode = readConsistentString(
        group.rows,
        (row) => row.update_action_code,
      );
      const deleteActionCode = readConsistentString(
        group.rows,
        (row) => row.delete_action_code,
      );
      const updateAction = updateActionCode
        ? REFERENTIAL_ACTION_BY_CODE[updateActionCode]
        : undefined;
      const deleteAction = deleteActionCode
        ? REFERENTIAL_ACTION_BY_CODE[deleteActionCode]
        : undefined;

      if (
        !columns ||
        !referencedColumns ||
        columns.length !== referencedColumns.length ||
        !referencedSchema ||
        !referencedTable ||
        !updateAction ||
        !deleteAction
      ) {
        return [];
      }

      return [
        {
          name: group.name,
          columns,
          referencedSchema,
          referencedTable,
          referencedColumns,
          updateAction,
          deleteAction,
        },
      ];
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
): BuildForeignKeyRelationsResult {
  const groups = groupConstraints(constraints);
  const candidateKeys = buildCandidateKeys(groups);
  const declaredConstraints = buildDeclaredConstraints(groups);
  const constraintColumnSets = buildConstraintColumnSets(candidateKeys);
  const uniqueConstraintsByColumn = new Map<string, string[]>();
  const primaryConstraintsByColumn = new Map<string, string[]>();

  declaredConstraints.forEach((constraint) => {
    const constraintsByColumn =
      constraint.type === 'p'
        ? primaryConstraintsByColumn
        : uniqueConstraintsByColumn;

    constraint.columns.forEach((column) => {
      appendToMap(constraintsByColumn, column, constraint.name);
    });
  });

  const uniqueConstraints = declaredConstraints.flatMap(
    (constraint): UniqueConstraint[] =>
      constraint.type === 'u'
        ? [
            {
              id: JSON.stringify(['uniqueConstraint', constraint.name]),
              originalName: constraint.name,
              name: constraint.name,
              columns: [...constraint.columns],
              nullsNotDistinct: constraint.nullsNotDistinct,
            },
          ]
        : [],
  );
  const foreignKeyRelations = buildForeignKeys(groups).map(
    (relation): ForeignKeyRelation => ({
      ...relation,
      oneToOne: computeForeignKeyOneToOne(relation.columns, {
        constraintColumnSets,
      }),
    }),
  );
  return {
    foreignKeyRelations,
    uniqueConstraintsByColumn,
    primaryConstraintsByColumn,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
  };
}
