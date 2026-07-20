import type { CandidateKey } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export type ResolvedReferencedTarget =
  | { mode: 'candidate'; candidate: CandidateKey }
  | { mode: 'legacy'; label: string };

function hasSameColumns(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((column) => right.includes(column))
  );
}

function candidateSort(
  referencedColumns: string[],
  left: CandidateKey,
  right: CandidateKey,
) {
  const leftExact = left.columns.every(
    (column, index) => column === referencedColumns[index],
  );
  const rightExact = right.columns.every(
    (column, index) => column === referencedColumns[index],
  );
  if (leftExact !== rightExact) return leftExact ? -1 : 1;
  if (left.kind !== right.kind) return left.kind === 'primaryKey' ? -1 : 1;
  return left.name.localeCompare(right.name);
}

export default function resolveExistingReferencedTarget(
  referencedColumns: string[],
  candidates: CandidateKey[],
): ResolvedReferencedTarget {
  const genuineMatch = candidates
    .filter(
      ({ kind, columns }) =>
        kind !== 'standaloneUniqueIndex' &&
        hasSameColumns(columns, referencedColumns),
    )
    .sort((left, right) => candidateSort(referencedColumns, left, right))[0];

  if (genuineMatch) {
    return { mode: 'candidate', candidate: genuineMatch };
  }

  const indexMatch = candidates.find(
    ({ kind, columns }) =>
      kind === 'standaloneUniqueIndex' &&
      hasSameColumns(columns, referencedColumns),
  );
  return {
    mode: 'legacy',
    label: indexMatch
      ? `Legacy unique index ${indexMatch.name} (${referencedColumns.join(', ')})`
      : `Legacy persisted target (${referencedColumns.join(', ')})`,
  };
}
