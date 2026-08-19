import { parseQueryResultJson } from '@/features/orgs/projects/database/common/utils/parseQueryResultJson';
import type {
  CandidateKey,
  CompleteKeyColumnSet,
  ForeignKeyRelation,
  NormalizedQueryDataRow,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  buildForeignKeyRelations,
  type RawTableConstraint,
} from '@/features/orgs/projects/database/dataGrid/utils/buildForeignKeyRelations';

export interface ParsedTableColumnsAndConstraints {
  columns: NormalizedQueryDataRow[];
  foreignKeyRelations: ForeignKeyRelation[];
  candidateKeys: CandidateKey[];
  uniqueConstraints: UniqueConstraint[];
  constraintColumnSets: CompleteKeyColumnSet[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseColumn(value: string): NormalizedQueryDataRow {
  const parsed = parseQueryResultJson<unknown>(value);

  if (!isRecord(parsed)) {
    throw new Error('The database returned invalid column metadata.');
  }

  return parsed as NormalizedQueryDataRow;
}

function parseConstraint(value: string): RawTableConstraint {
  const parsed = parseQueryResultJson<unknown>(value);

  if (!isRecord(parsed)) {
    throw new Error('The database returned invalid constraint metadata.');
  }

  return parsed as unknown as RawTableConstraint;
}

/** Parse and decorate all table introspection rows at one boundary. */
export default function parseTableColumnsAndConstraints(
  rawColumns: string[],
  rawConstraints: string[],
  schema: string,
): ParsedTableColumnsAndConstraints {
  const parsedColumns = rawColumns.map(parseColumn);
  const parsedConstraints = rawConstraints.map(parseConstraint);
  const {
    foreignKeyRelations: parsedForeignKeyRelations,
    uniqueConstraintsByColumn,
    primaryConstraintsByColumn,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
  } = buildForeignKeyRelations(parsedConstraints, schema);

  const tableColumnNames = new Set(
    parsedColumns.map((column) => String(column.column_name)),
  );
  const foreignKeyRelations = parsedForeignKeyRelations.filter((relation) =>
    relation.columns.every((column) => tableColumnNames.has(column)),
  );
  const foreignKeyRelationsByColumn = new Map<string, ForeignKeyRelation>();

  foreignKeyRelations.forEach((relation) => {
    relation.columns.forEach((column) => {
      if (!foreignKeyRelationsByColumn.has(column)) {
        foreignKeyRelationsByColumn.set(column, relation);
      }
    });
  });

  const columns = parsedColumns
    .map(
      (column): NormalizedQueryDataRow => ({
        ...column,
        unique_constraints:
          uniqueConstraintsByColumn.get(String(column.column_name)) ?? [],
        primary_constraints:
          primaryConstraintsByColumn.get(String(column.column_name)) ?? [],
        foreign_key_relation:
          foreignKeyRelationsByColumn.get(String(column.column_name)) ?? null,
      }),
    )
    .sort(
      (left, right) =>
        Number(left.ordinal_position) - Number(right.ordinal_position),
    );

  return {
    columns,
    foreignKeyRelations,
    candidateKeys,
    uniqueConstraints,
    constraintColumnSets,
  };
}
