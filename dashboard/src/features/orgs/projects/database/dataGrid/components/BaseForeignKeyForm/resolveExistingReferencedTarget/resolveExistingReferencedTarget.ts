import type { CandidateKey } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { areStrArraysEqual } from '@/lib/utils';

type ResolvedReferencedTarget =
  | { mode: 'candidate'; candidate: CandidateKey }
  | { mode: 'unmanaged'; label: string };

export function describeUnmanagedTarget(referencedColumns: string[]): string {
  return `Current target (${referencedColumns.join(', ')})`;
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
  if (leftExact !== rightExact) {
    return leftExact ? -1 : 1;
  }
  if (left.kind !== right.kind) {
    return left.kind === 'primaryKey' ? -1 : 1;
  }
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
        areStrArraysEqual(columns, referencedColumns),
    )
    .sort((left, right) => candidateSort(referencedColumns, left, right))[0];

  if (genuineMatch) {
    return { mode: 'candidate', candidate: genuineMatch };
  }

  const indexMatch = candidates
    .filter(
      ({ kind, columns }) =>
        kind === 'standaloneUniqueIndex' &&
        areStrArraysEqual(columns, referencedColumns),
    )
    .sort((left, right) => candidateSort(referencedColumns, left, right))[0];
  return {
    mode: 'unmanaged',
    label: indexMatch
      ? `UNIQUE INDEX ${indexMatch.name} (${referencedColumns.join(', ')})`
      : describeUnmanagedTarget(referencedColumns),
  };
}
