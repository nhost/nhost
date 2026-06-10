import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type { HasuraMetadataPermission } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isEmptyValue } from '@/lib/utils';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';

export interface UseComputedFieldDependentsOptions {
  table: QualifiedTable;
  dataSource: string;
  computedFieldName: string;
}

/**
 * Returns the role names of select permissions that reference the given
 * computed field. These are the dependents that would be dropped when the
 * field is deleted or edited (which sends `cascade: true` to Hasura).
 *
 * `select_permissions` is not exposed in the generated OpenAPI types, so the
 * table metadata is narrowed locally.
 */
export default function useComputedFieldDependents({
  table,
  dataSource,
  computedFieldName,
}: UseComputedFieldDependentsOptions) {
  return useExportMetadata((data): string[] => {
    if (isEmptyValue(data.metadata.sources)) {
      return [];
    }

    const sourceMetadata = data.metadata.sources!.find(
      (item) => item.name === dataSource,
    );
    if (isEmptyValue(sourceMetadata?.tables)) {
      return [];
    }

    const tableMetadata = sourceMetadata!.tables!.find(
      (item) =>
        item.table.name === table.name && item.table.schema === table.schema,
    );

    const selectPermissions =
      (
        tableMetadata as unknown as
          | { select_permissions?: HasuraMetadataPermission[] }
          | undefined
      )?.select_permissions ?? [];

    return selectPermissions
      .filter((p) => p.permission.computed_fields?.includes(computedFieldName))
      .map((p) => p.role);
  });
}
