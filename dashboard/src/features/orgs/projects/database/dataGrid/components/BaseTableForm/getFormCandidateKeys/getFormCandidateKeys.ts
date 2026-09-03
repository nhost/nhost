import { getGeneratedUniqueConstraintName } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/getGeneratedUniqueConstraintName';
import type {
  CandidateKey,
  DatabaseColumn,
  FormUniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function getFormCandidateKeys({
  tableName,
  columns,
  primaryKeyIndices,
  uniqueConstraints,
}: {
  tableName: string;
  columns: DatabaseColumn[];
  primaryKeyIndices: string[];
  uniqueConstraints: FormUniqueConstraint[];
}): CandidateKey[] {
  const candidateKeys: CandidateKey[] = [];
  const primaryKeyColumns = primaryKeyIndices.flatMap((index) => {
    const columnName = columns[Number(index)]?.name;
    return columnName ? [columnName] : [];
  });

  if (
    primaryKeyColumns.length > 0 &&
    primaryKeyColumns.length === primaryKeyIndices.length &&
    new Set(primaryKeyColumns).size === primaryKeyColumns.length
  ) {
    candidateKeys.push({
      id: 'form-primary-key',
      name: `${tableName}_pkey`,
      kind: 'primaryKey',
      columns: primaryKeyColumns,
    });
  }

  const columnNamesByReference = new Map(
    columns.flatMap((column) =>
      column.formReference ? [[column.formReference, column.name]] : [],
    ),
  );

  uniqueConstraints.forEach((constraint) => {
    const constraintColumns = constraint.columnReferences.flatMap(
      (reference) => {
        const columnName = columnNamesByReference.get(reference);
        return columnName ? [columnName] : [];
      },
    );

    if (
      constraintColumns.length === 0 ||
      constraintColumns.length !== constraint.columnReferences.length ||
      new Set(constraintColumns).size !== constraintColumns.length
    ) {
      return;
    }

    candidateKeys.push({
      id: `form-unique-${constraint.id}`,
      name:
        constraint.name?.trim() ||
        getGeneratedUniqueConstraintName(tableName, constraintColumns),
      kind: 'uniqueConstraint',
      columns: constraintColumns,
    });
  });

  return candidateKeys;
}
