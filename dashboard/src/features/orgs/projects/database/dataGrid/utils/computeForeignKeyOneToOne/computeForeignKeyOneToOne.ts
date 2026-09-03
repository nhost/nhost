import type { CompleteKeyColumnSet } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isCompleteColumnSet } from '@/features/orgs/projects/database/dataGrid/utils/isCompleteColumnSet';

function isCandidateKeySubset(
  candidateKey: readonly string[],
  foreignKeyColumns: string[],
): boolean {
  if (!isCompleteColumnSet(candidateKey)) {
    return false;
  }

  const foreignKeyColumnSet = new Set(foreignKeyColumns);
  return candidateKey.every((column) => foreignKeyColumnSet.has(column));
}

/**
 * A foreign key is one-to-one when its complete local column set contains a
 * complete primary, UNIQUE-constraint, or eligible unique-index set.
 */
export default function computeForeignKeyOneToOne(
  foreignKeyColumns: string[],
  constraintColumnSets: CompleteKeyColumnSet[],
): boolean {
  if (!isCompleteColumnSet(foreignKeyColumns)) {
    return false;
  }

  return constraintColumnSets.some((columnSet) =>
    isCandidateKeySubset(columnSet, foreignKeyColumns),
  );
}
