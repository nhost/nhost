import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Candidate keys of the local table as the form knows them: the primary key,
 * every named unique constraint, and uniquely indexed columns that belong to
 * no constraint, which is also how introspection derives them.
 */
export default function getCandidateKeyColumnSets(
  columns: DatabaseColumn[] = [],
): string[][] {
  const namedConstraints = new Map<string, string[]>();

  columns.forEach(({ name, uniqueConstraints }) => {
    uniqueConstraints?.forEach((constraintName) => {
      namedConstraints.set(constraintName, [
        ...(namedConstraints.get(constraintName) ?? []),
        name,
      ]);
    });
  });

  return [
    columns.filter(({ isPrimary }) => isPrimary).map(({ name }) => name),
    ...namedConstraints.values(),
    ...columns
      .filter(
        ({ isPrimary, isUnique, uniqueConstraints }) =>
          isUnique && !isPrimary && !uniqueConstraints?.length,
      )
      .map(({ name }) => [name]),
  ];
}
