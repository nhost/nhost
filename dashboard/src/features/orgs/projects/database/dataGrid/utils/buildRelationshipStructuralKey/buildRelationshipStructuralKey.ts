import type { RelationshipColumnPair } from '@/features/orgs/projects/database/dataGrid/types/relationships';

export type { RelationshipColumnPair };

interface RelationshipIdentityEndpoint {
  readonly schema: string;
  readonly table: string;
}

export interface LocalRelationshipIdentityInput {
  readonly type: 'Array' | 'Object';
  readonly source: string;
  readonly from: RelationshipIdentityEndpoint;
  readonly to: RelationshipIdentityEndpoint;
  readonly columnPairs: readonly RelationshipColumnPair[];
  readonly allowRepeatedToColumns?: boolean;
}

type AlignmentSide = 'fromColumn' | 'toColumn';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const hasDuplicates = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

function isValidColumnList(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString) &&
    !hasDuplicates(value)
  );
}

export function zipRelationshipColumnPairs(
  fromColumns: unknown,
  toColumns: unknown,
): RelationshipColumnPair[] | undefined {
  if (
    !isValidColumnList(fromColumns) ||
    !isValidColumnList(toColumns) ||
    fromColumns.length !== toColumns.length
  ) {
    return undefined;
  }

  return fromColumns.map((fromColumn, index) => ({
    fromColumn,
    toColumn: toColumns[index],
  }));
}

export function alignRelationshipColumnPairs(
  columnPairs: readonly RelationshipColumnPair[],
  requestedColumns: readonly string[],
  alignmentSide: AlignmentSide,
): RelationshipColumnPair[] | undefined {
  if (!Array.isArray(columnPairs) || !Array.isArray(requestedColumns)) {
    return undefined;
  }

  const alignmentColumns = columnPairs.map((pair) => pair[alignmentSide]);
  const fromColumns = columnPairs.map(({ fromColumn }) => fromColumn);
  const toColumns = columnPairs.map(({ toColumn }) => toColumn);

  if (
    columnPairs.length === 0 ||
    requestedColumns.length !== columnPairs.length ||
    requestedColumns.some((column) => !isNonEmptyString(column)) ||
    fromColumns.some((column) => !isNonEmptyString(column)) ||
    toColumns.some((column) => !isNonEmptyString(column)) ||
    hasDuplicates(fromColumns) ||
    hasDuplicates(toColumns) ||
    hasDuplicates(alignmentColumns) ||
    hasDuplicates(requestedColumns)
  ) {
    return undefined;
  }

  const pairsByAlignmentColumn = new Map(
    columnPairs.map((pair) => [pair[alignmentSide], pair]),
  );
  const alignedPairs: RelationshipColumnPair[] = [];
  for (const column of requestedColumns) {
    const pair = pairsByAlignmentColumn.get(column);
    if (!pair) {
      return undefined;
    }

    alignedPairs.push({ ...pair });
  }

  return alignedPairs;
}

const compareStrings = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
};

export interface ArrayRelationshipRemoteIdentityInput {
  readonly source: string;
  readonly from: RelationshipIdentityEndpoint;
  readonly to: RelationshipIdentityEndpoint;
  readonly remoteColumns: readonly string[];
}

/**
 * Fallback identity for an FK-backed array relationship whose local columns
 * cannot be resolved. Manual and resolved relationships must use their full
 * column pairs so distinct mappings remain distinct.
 */
export function buildArrayRelationshipRemoteKey({
  source,
  from,
  to,
  remoteColumns,
}: ArrayRelationshipRemoteIdentityInput): string | undefined {
  if (
    !isNonEmptyString(source) ||
    !isNonEmptyString(from.schema) ||
    !isNonEmptyString(from.table) ||
    !isNonEmptyString(to.schema) ||
    !isNonEmptyString(to.table) ||
    !isValidColumnList(remoteColumns)
  ) {
    return undefined;
  }

  return JSON.stringify([
    'ArrayRemote',
    source,
    [from.schema, from.table],
    [to.schema, to.table],
    [...remoteColumns].sort(compareStrings),
  ]);
}

const compareColumnPairs = (
  left: RelationshipColumnPair,
  right: RelationshipColumnPair,
): number =>
  compareStrings(left.fromColumn, right.fromColumn) ||
  compareStrings(left.toColumn, right.toColumn);

export default function buildRelationshipStructuralKey({
  type,
  source,
  from,
  to,
  columnPairs,
  allowRepeatedToColumns = false,
}: LocalRelationshipIdentityInput): string | undefined {
  if (
    !isNonEmptyString(source) ||
    !isNonEmptyString(from.schema) ||
    !isNonEmptyString(from.table) ||
    !isNonEmptyString(to.schema) ||
    !isNonEmptyString(to.table) ||
    !Array.isArray(columnPairs) ||
    columnPairs.length === 0 ||
    columnPairs.some(
      ({ fromColumn, toColumn }) =>
        !isNonEmptyString(fromColumn) || !isNonEmptyString(toColumn),
    ) ||
    hasDuplicates(columnPairs.map(({ fromColumn }) => fromColumn)) ||
    (!allowRepeatedToColumns &&
      hasDuplicates(columnPairs.map(({ toColumn }) => toColumn)))
  ) {
    return undefined;
  }

  const canonicalPairs = [...columnPairs]
    .sort(compareColumnPairs)
    .map(({ fromColumn, toColumn }) => [fromColumn, toColumn] as const);

  return JSON.stringify([
    type,
    source,
    [from.schema, from.table],
    [to.schema, to.table],
    canonicalPairs,
  ]);
}
