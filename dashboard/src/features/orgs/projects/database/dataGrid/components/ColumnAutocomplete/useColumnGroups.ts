import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import { getForeignKeyConstraintColumns } from '@/features/orgs/projects/database/common/utils/getForeignKeyConstraintColumns';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isFKConstraintOnSameTable } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import { isNotEmptyValue } from '@/lib/utils';
import type { AutocompleteOption } from './types';

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
  const { columns, foreignKeyRelations } = tableData || {};

  const constraintTargetMap = foreignKeyRelations?.reduce(
    (map, currentRelation) =>
      map.set(JSON.stringify(currentRelation.columns), {
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
  ].reduce<
    {
      schema: string;
      table: string;
      column: string;
      constraintColumns: string[];
      resolveTargetFromForeignKey: boolean;
      name: string;
    }[]
  >((relationships, currentRelationship) => {
    if (isNotEmptyValue(currentRelationship?.using)) {
      const { foreign_key_constraint_on, manual_configuration } =
        currentRelationship.using;

      if (manual_configuration) {
        return [
          ...relationships,
          ...Object.keys(manual_configuration.column_mapping).map((column) => ({
            schema: manual_configuration.remote_table?.schema || 'public',
            table: manual_configuration.remote_table?.name,
            column,
            constraintColumns: [column],
            resolveTargetFromForeignKey: false,
            name: currentRelationship.name,
          })),
        ];
      }

      const isSameTable = isFKConstraintOnSameTable(foreign_key_constraint_on);

      if (
        isSameTable &&
        isNotEmptyValue(selectedSchema) &&
        isNotEmptyValue(selectedTable)
      ) {
        const constraintColumns = getForeignKeyConstraintColumns(
          foreign_key_constraint_on,
        );
        // A composite FK still points at a single table, so its first
        // column is enough to build the one option for this relationship.
        const [column] = constraintColumns;

        return [
          ...relationships,
          {
            schema: selectedSchema,
            table: selectedTable,
            column,
            constraintColumns,
            resolveTargetFromForeignKey: true,
            name: currentRelationship.name,
          },
        ];
      }

      if (!isSameTable && isNotEmptyValue(foreign_key_constraint_on)) {
        const { table } = foreign_key_constraint_on;
        const constraintColumns = getForeignKeyConstraintColumns(
          foreign_key_constraint_on,
        );
        const [column] = constraintColumns;

        return [
          ...relationships,
          {
            schema: table?.schema ?? 'public',
            table: table?.name ?? '',
            column,
            constraintColumns,
            resolveTargetFromForeignKey: false,
            name: currentRelationship.name,
          },
        ];
      }
    }
    return relationships;
  }, []);

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
          ...(relationship.resolveTargetFromForeignKey
            ? constraintTargetMap?.get(
                JSON.stringify(relationship.constraintColumns),
              ) || {}
            : {}),
          name: relationship.name,
        },
      },
    })),
  ];
}
