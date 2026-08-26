import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { RelationshipColumnPair } from '@/features/orgs/projects/database/dataGrid/types/relationships';
import { isCompleteColumnSet } from '@/features/orgs/projects/database/dataGrid/utils/isCompleteColumnSet';
import { isNonEmptyString } from '@/lib/utils';

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

const hasDuplicates = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

export function zipRelationshipColumnPairs(
  fromColumns: unknown,
  toColumns: unknown,
): RelationshipColumnPair[] | undefined {
  if (
    !isCompleteColumnSet(fromColumns) ||
    !isCompleteColumnSet(toColumns) ||
    fromColumns.length !== toColumns.length
  ) {
    return undefined;
  }

  return fromColumns.map((fromColumn, index) => ({
    fromColumn,
    toColumn: toColumns[index],
  }));
}

export interface ForeignKeyColumnPairMatch {
  relation: ForeignKeyRelation;
  columnPairs: RelationshipColumnPair[];
}

/**
 * Foreign keys whose local columns are exactly `localColumns`, with their
 * pairs aligned to that column order.
 */
export function matchForeignKeysToLocalColumns(
  foreignKeyRelations: readonly ForeignKeyRelation[],
  localColumns: readonly string[],
): ForeignKeyColumnPairMatch[] {
  return foreignKeyRelations.flatMap((relation) => {
    const pairs = zipRelationshipColumnPairs(
      relation.columns,
      relation.referencedColumns,
    );
    const alignedPairs = pairs
      ? alignRelationshipColumnPairs(pairs, localColumns, 'fromColumn')
      : undefined;

    return alignedPairs ? [{ relation, columnPairs: alignedPairs }] : [];
  });
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
    !isCompleteColumnSet(remoteColumns)
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

/** Locale-independent canonical order for column-pair identity keys. */
export function canonicalizeColumnPairs(
  columnPairs: readonly RelationshipColumnPair[],
): (readonly [string, string])[] {
  return [...columnPairs]
    .sort(compareColumnPairs)
    .map(({ fromColumn, toColumn }) => [fromColumn, toColumn] as const);
}

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

  return JSON.stringify([
    type,
    source,
    [from.schema, from.table],
    [to.schema, to.table],
    canonicalizeColumnPairs(columnPairs),
  ]);
}
