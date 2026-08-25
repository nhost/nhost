import type {
  DatabaseColumn,
  FormUniqueConstraint,
  UniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Resolves form-level UNIQUE constraints (which reference columns by their
 * stable `formReference`, so they survive column renames) into the
 * name-addressed shape the SQL builders expect.
 *
 * A supplied name is trimmed, except when it still equals `originalName` — an
 * untouched name is passed through verbatim so it is not reported as a rename.
 *
 * @throws if a constraint references a column that is no longer in the form.
 */
export default function serializeFormUniqueConstraints(
  columns: DatabaseColumn[],
  formUniqueConstraints: FormUniqueConstraint[],
): UniqueConstraint[] {
  const columnNamesByReference = new Map(
    columns.map((column) => [column.formReference, column.name]),
  );

  return formUniqueConstraints.map((constraint) => ({
    id: constraint.id,
    originalName: constraint.originalName ?? '',
    name:
      constraint.originalName && constraint.name === constraint.originalName
        ? constraint.name
        : (constraint.name?.trim() ?? ''),
    nullsNotDistinct: constraint.nullsNotDistinct,
    columns: constraint.columnReferences.map((reference) => {
      const name = columnNamesByReference.get(reference);
      if (!name) {
        throw new Error('A UNIQUE constraint references a missing column.');
      }

      return name;
    }),
  }));
}
