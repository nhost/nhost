import type { FetchMetadataReturnType } from '@/hooks/dataBrowser/useMetadataQuery';
import type { FetchTableReturnType } from '@/hooks/dataBrowser/useTableQuery';
import type { AutocompleteOption } from '@/ui/v2/Autocomplete';

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
      metadata: { type: column.udt_name },
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
  ].map((relationship) => {
    const { foreign_key_constraint_on } = relationship?.using || {};

    if (typeof foreign_key_constraint_on === 'string') {
      return {
        schema: selectedSchema,
        table: selectedTable,
        column: foreign_key_constraint_on,
        name: relationship.name,
      };
    }

    return {
      schema: foreign_key_constraint_on.table.schema,
      table: foreign_key_constraint_on.table.name,
      column: foreign_key_constraint_on.column,
      name: relationship.name,
    };
  });

  return [
    ...columnOptions,
    ...objectAndArrayRelationships.map((relationship) => ({
      label: relationship.name,
      value: relationship.name,
      group: 'relationships',
      metadata: {
        target: {
          ...(columnTargetMap?.get(relationship.column) || {}),
          name: relationship.name,
        },
      },
    })),
  ];
}
