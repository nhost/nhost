import type { AutocompleteOption } from '@/components/ui/v2/Autocomplete';
import type { FetchMetadataReturnType } from '@/features/database/dataGrid/hooks/useMetadataQuery';
import type { FetchTableReturnType } from '@/features/database/dataGrid/hooks/useTableQuery';

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
  tableData?: FetchTableReturnType;
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
  const { columns, foreignKeyRelations } = tableData || {};

  const columnTargetMap = foreignKeyRelations?.reduce(
    (map, currentRelation) =>
      map.set(currentRelation.columnName, {
        schema: currentRelation.referencedSchema || 'public',
        table: currentRelation.referencedTable,
      }),
    new Map<string, { schema: string; table: string }>(),
  );

  const columnOptions: AutocompleteOption[] =
    columns?.map((column) => ({
      label: column.column_name,
      value: column.column_name,
      group: 'columns',
      metadata: column,
    })) || [];

  if (disableRelationships) {
    return columnOptions;
  }

  const { object_relationships, array_relationships } =
    metadata?.tables?.find(
      ({ table: metadataTable }) =>
        metadataTable.name === selectedTable &&
        metadataTable.schema === selectedSchema,
    ) || {};

  const objectAndArrayRelationships = [
    ...(object_relationships || []),
    ...(array_relationships || []),
  ].reduce((relationships, currentRelationship) => {
    const { foreign_key_constraint_on, manual_configuration } =
      currentRelationship?.using || {};

    if (manual_configuration) {
      return [
        ...relationships,
        ...Object.keys(manual_configuration.column_mapping).map((column) => ({
          schema: manual_configuration.remote_table?.schema || 'public',
          table: manual_configuration.remote_table?.name,
          column,
          name: currentRelationship.name,
        })),
      ];
    }

    if (typeof foreign_key_constraint_on === 'string') {
      return [
        ...relationships,
        {
          schema: selectedSchema,
          table: selectedTable,
          column: foreign_key_constraint_on,
          name: currentRelationship.name,
        },
      ];
    }

    return [
      ...relationships,
      {
        schema: foreign_key_constraint_on.table.schema,
        table: foreign_key_constraint_on.table.name,
        column: foreign_key_constraint_on.column,
        name: currentRelationship.name,
      },
    ];
  }, [] as { schema: string; table: string; column: string; name: string }[]);

  return [
    ...columnOptions,
    ...objectAndArrayRelationships.map((relationship) => ({
      label: relationship.name,
      value: relationship.name,
      group: 'relationships',
      metadata: {
        target: {
          schema: relationship.schema,
          table: relationship.table,
          column: relationship.column,
          ...(columnTargetMap?.get(relationship.column) || {}),
          name: relationship.name,
        },
      },
    })),
  ];
}
