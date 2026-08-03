export interface RelationshipColumnPair {
  readonly fromColumn: string;
  readonly toColumn: string;
}

export interface RelationshipIdentityEndpoint {
  readonly schema: string;
  readonly table: string;
}

export interface LocalRelationshipIdentityInput {
  readonly type: 'Array' | 'Object';
  readonly source: string;
  readonly from: RelationshipIdentityEndpoint;
  readonly to: RelationshipIdentityEndpoint;
  readonly columnPairs: readonly RelationshipColumnPair[];
}

type AlignmentSide = 'fromColumn' | 'toColumn';

const isNonEmptyString = (value: string): boolean => value.length > 0;

const hasDuplicates = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

export function zipRelationshipColumnPairs(
  fromColumns: readonly string[],
  toColumns: readonly string[],
): RelationshipColumnPair[] | undefined {
  if (
    fromColumns.length === 0 ||
    fromColumns.length !== toColumns.length ||
    fromColumns.some((column) => !isNonEmptyString(column)) ||
    toColumns.some((column) => !isNonEmptyString(column))
  ) {
    return undefined;
  }

  return fromColumns.map((fromColumn, index) => ({
    fromColumn,
    toColumn: toColumns[index],
  }));
}

function alignRelationshipColumnPairs(
  columnPairs: readonly RelationshipColumnPair[],
  requestedColumns: readonly string[],
  alignmentSide: AlignmentSide,
): RelationshipColumnPair[] | undefined {
  const alignmentColumns = columnPairs.map((pair) => pair[alignmentSide]);

  if (
    columnPairs.length === 0 ||
    requestedColumns.length !== columnPairs.length ||
    requestedColumns.some((column) => !isNonEmptyString(column)) ||
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

export function alignRelationshipColumnPairsByFromColumns(
  columnPairs: readonly RelationshipColumnPair[],
  requestedFromColumns: readonly string[],
): RelationshipColumnPair[] | undefined {
  return alignRelationshipColumnPairs(
    columnPairs,
    requestedFromColumns,
    'fromColumn',
  );
}

export function alignRelationshipColumnPairsByToColumns(
  columnPairs: readonly RelationshipColumnPair[],
  requestedToColumns: readonly string[],
): RelationshipColumnPair[] | undefined {
  return alignRelationshipColumnPairs(
    columnPairs,
    requestedToColumns,
    'toColumn',
  );
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
}: LocalRelationshipIdentityInput): string | undefined {
  if (
    !isNonEmptyString(source) ||
    !isNonEmptyString(from.schema) ||
    !isNonEmptyString(from.table) ||
    !isNonEmptyString(to.schema) ||
    !isNonEmptyString(to.table) ||
    columnPairs.length === 0 ||
    columnPairs.some(
      ({ fromColumn, toColumn }) =>
        !isNonEmptyString(fromColumn) || !isNonEmptyString(toColumn),
    )
  ) {
    return undefined;
  }

  const canonicalPairs = columnPairs
    .map(({ fromColumn, toColumn }) => [fromColumn, toColumn] as const)
    .sort(([leftFrom, leftTo], [rightFrom, rightTo]) =>
      compareColumnPairs(
        { fromColumn: leftFrom, toColumn: leftTo },
        { fromColumn: rightFrom, toColumn: rightTo },
      ),
    );

  return JSON.stringify([
    type,
    source,
    [from.schema, from.table],
    [to.schema, to.table],
    canonicalPairs,
  ]);
}
