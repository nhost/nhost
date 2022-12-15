import type { FetchMetadataReturnType } from '@/hooks/dataBrowser/useMetadataQuery';
import type { FetchTableReturnType } from '@/hooks/dataBrowser/useTableQuery';
import type { HasuraMetadataTable } from '@/types/dataBrowser';
import type { AutocompleteOption } from '@/ui/v2/Autocomplete';
import { useEffect, useState } from 'react';

export interface UseAsyncInitialValueOptions {
  /**
   * Selected schema to be used to determine the initial value.
   */
  selectedSchema?: string;
  /**
   * Selected table to be used to determine the initial value.
   */
  selectedTable?: string;
  /**
   * Initial value to be used before the async value is loaded.
   */
  initialValue?: string;
  /**
   * Determines whether or not the table data is loading.
   */
  isTableLoading?: boolean;
  /**
   * Determines whether or not the metadata is loading.
   */
  isMetadataLoading?: boolean;
  /**
   * Table data to be used to determine the initial value.
   */
  tableData?: FetchTableReturnType;
  /**
   * Metadata to be used to determine the initial value.
   */
  metadata?: FetchMetadataReturnType;
  /**
   * Function to be called when the input is asynchronously initialized.
   */
  onInitialized?: (value: {
    value: string;
    columnMetadata?: Record<string, any>;
  }) => void;
}

export default function useAsyncInitialValue({
  selectedSchema,
  selectedTable,
  initialValue,
  isTableLoading,
  isMetadataLoading,
  tableData,
  metadata,
  onInitialized,
}: UseAsyncInitialValueOptions) {
  const [inputValue, setInputValue] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [remainingColumnPath, setRemainingColumnPath] = useState(
    initialValue?.split('.') || [],
  );
  const [selectedRelationships, setSelectedRelationships] = useState<
    { schema: string; table: string; name: string }[]
  >([]);
  const relationshipDotNotation =
    initialized && selectedRelationships?.length > 0
      ? selectedRelationships.map((relationship) => relationship.name).join('.')
      : '';
  const [selectedColumn, setSelectedColumn] =
    useState<AutocompleteOption>(null);

  const activeRelationship =
    selectedRelationships[selectedRelationships.length - 1];

  useEffect(() => {
    if (remainingColumnPath?.length > 0 || initialized) {
      return;
    }

    setInitialized(true);

    if (!selectedColumn) {
      return;
    }

    onInitialized?.({
      value:
        selectedRelationships.length > 0
          ? [relationshipDotNotation, selectedColumn.value].join('.')
          : selectedColumn.value,
      columnMetadata: selectedColumn.metadata,
    });
  }, [
    initialized,
    onInitialized,
    relationshipDotNotation,
    remainingColumnPath?.length,
    selectedColumn,
    selectedRelationships.length,
  ]);

  useEffect(() => {
    if (
      remainingColumnPath?.length !== 1 ||
      isTableLoading ||
      !tableData?.columns
    ) {
      return;
    }

    const [activeColumn] = remainingColumnPath;

    // If there is a single column in the path, it means that we can look for it
    // in the table columns
    if (
      !tableData.columns.some((column) => column.column_name === activeColumn)
    ) {
      setRemainingColumnPath([]);

      return;
    }

    setSelectedColumn({
      value: activeColumn,
      label: activeColumn,
      group: 'columns',
      metadata: tableData.columns.find(
        (column) => column.column_name === activeColumn,
      ),
    });
    setRemainingColumnPath((columnPath) => columnPath.slice(1));
    setInputValue(activeColumn);
  }, [remainingColumnPath, isTableLoading, tableData?.columns]);

  useEffect(() => {
    if (
      remainingColumnPath.length < 2 ||
      isTableLoading ||
      isMetadataLoading ||
      !tableData?.columns
    ) {
      return;
    }

    const metadataMap = metadata.tables.reduce(
      (map, metadataTable) =>
        map.set(
          `${metadataTable.table.schema}.${metadataTable.table.name}`,
          metadataTable,
        ),
      new Map<string, HasuraMetadataTable>(),
    );

    const [nextPath] = remainingColumnPath.slice(
      0,
      remainingColumnPath.length - 1,
    );

    const tableMetadata = metadataMap.get(`${selectedSchema}.${selectedTable}`);
    const currentRelationship = [
      ...(tableMetadata.object_relationships || []),
      ...(tableMetadata.array_relationships || []),
    ].find(({ name }) => name === nextPath);

    if (!currentRelationship) {
      setRemainingColumnPath([]);
      return;
    }

    const { foreign_key_constraint_on: metadataConstraint } =
      currentRelationship.using || {};

    // In some cases the metadata already contains the schema and table name
    if (typeof metadataConstraint !== 'string') {
      setSelectedRelationships((currentRelationships) => [
        ...currentRelationships,
        {
          schema: metadataConstraint.table.schema || 'public',
          table: metadataConstraint.table.name,
          name: nextPath,
        },
      ]);

      setRemainingColumnPath((columnPath) => columnPath.slice(1));

      return;
    }

    const foreignKeyRelation = tableData?.foreignKeyRelations?.find(
      ({ columnName }) => {
        const { foreign_key_constraint_on } = currentRelationship.using || {};

        if (!foreign_key_constraint_on) {
          return false;
        }

        if (typeof foreign_key_constraint_on === 'string') {
          return foreign_key_constraint_on === columnName;
        }

        return foreign_key_constraint_on.column === columnName;
      },
    );

    if (!foreignKeyRelation) {
      setRemainingColumnPath([]);
      return;
    }

    setSelectedRelationships((currentRelationships) => [
      ...currentRelationships,
      {
        schema: foreignKeyRelation.referencedSchema || 'public',
        table: foreignKeyRelation.referencedTable,
        name: nextPath,
      },
    ]);

    setRemainingColumnPath((columnPath) => columnPath.slice(1));
  }, [
    selectedSchema,
    selectedTable,
    metadata?.tables,
    tableData?.columns,
    tableData?.foreignKeyRelations,
    remainingColumnPath,
    isTableLoading,
    isMetadataLoading,
  ]);

  return {
    initialized,
    inputValue,
    setInputValue,
    activeRelationship,
    selectedRelationships: initialized ? selectedRelationships : [],
    selectedColumn: initialized ? selectedColumn : null,
    setSelectedRelationships,
    setSelectedColumn,
    relationshipDotNotation,
  };
}
