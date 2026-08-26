import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { AutocompleteOption } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/types';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { resolveRelationshipTarget } from '@/features/orgs/projects/database/dataGrid/utils/resolveRelationshipTarget';

export interface UseColumnGroupsOptions {
  /**
   * Selected schema to be used to determines the column groups.
   */
  selectedSchema?: string;
  /**
   * Selected table to be used to determine the column groups.
   */
  selectedTable?: string;
  /**
   * Table data to be used to determine the column groups.
   */
  tableData?: FetchTableSchemaReturnType;
  /**
   * Metadata to be used to determine the column groups.
   */
  metadata?: FetchMetadataReturnType;
  /**
   * Determines whether or not to disable column groups.
   */
  disableRelationships?: boolean;
}

export default function useColumnGroups({
  selectedTable,
  selectedSchema,
  tableData,
  metadata,
  disableRelationships,
}: UseColumnGroupsOptions) {
  const columnOptions: AutocompleteOption[] =
    tableData?.columns?.map((column) => ({
      label: column.column_name,
      value: column.column_name,
      group: 'columns',
      metadata: column,
    })) ?? [];

  if (disableRelationships) {
    return columnOptions;
  }

  const metadataTable = metadata?.tables?.find(
    ({ table }) =>
      table.name === selectedTable && table.schema === selectedSchema,
  );
  const relationships = [
    ...(metadataTable?.object_relationships ?? []),
    ...(metadataTable?.array_relationships ?? []),
  ];

  const relationshipOptions = relationships.flatMap<AutocompleteOption>(
    (relationship) => {
      if (typeof relationship.name !== 'string') {
        return [];
      }

      const target = resolveRelationshipTarget({
        using: relationship.using,
        selectedSchema,
        selectedTable,
        foreignKeyRelations: tableData?.foreignKeyRelations,
        metadataTables: metadata?.tables,
      });
      if (!target) {
        return [];
      }

      return [
        {
          label: relationship.name,
          value: relationship.name,
          group: 'relationships',
          metadata: { target: { ...target, name: relationship.name } },
        },
      ];
    },
  );

  return [...columnOptions, ...relationshipOptions];
}
