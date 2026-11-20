import type {
  DataBrowserColumnMetadata,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export function getPickerRelations(
  columns: DataBrowserColumnMetadata[],
  relations: ForeignKeyRelation[],
) {
  const columnMap = new Map(columns.map((column) => [column.id, column]));
  const memberships = new Map<string, number>();
  for (const relation of relations) {
    for (const column of relation.columns) {
      memberships.set(column, (memberships.get(column) ?? 0) + 1);
    }
  }

  return relations.filter(
    (relation) =>
      relation.columns.length > 0 &&
      relation.columns.length === relation.referencedColumns.length &&
      relation.columns.every((id) => {
        const column = columnMap.get(id);
        return (
          column &&
          !column.isGenerated &&
          column.isEditable !== false &&
          memberships.get(id) === 1
        );
      }),
  );
}

export function requiresRecordValue(column: DataBrowserColumnMetadata) {
  return Boolean(
    column.isPrimary ||
      (!column.isNullable && !column.defaultValue && !column.isIdentity),
  );
}

export function formatPickerKeys(
  columns: string[],
  values: (string | null | undefined)[],
) {
  return columns
    .map((column, index) => `${column} ${values[index] ?? 'NULL'}`)
    .join(' · ');
}
