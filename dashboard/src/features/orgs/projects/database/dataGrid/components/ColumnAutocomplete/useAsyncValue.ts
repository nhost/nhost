import type { AutocompleteOption } from '@/components/ui/v2/Autocomplete';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type { FetchTableReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useEffect, useState } from 'react';

export interface UseAsyncValueOptions {
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

export default function useAsyncValue({
  selectedSchema,
  selectedTable,
  initialValue,
  isTableLoading,
  isMetadataLoading,
  tableData,
  metadata,
  onInitialized,
}: UseAsyncValueOptions) {
  const currentTablePath = `${selectedSchema}.${selectedTable}`;
  const [initialized, setInitialized] = useState(false);
  // We might not going to have the most up-to-date table data because the
  // relationship is loaded asynchronously, so we need to make sure we don't
  // look for the column in a stale table when initializing
  const [asyncTablePath, setAsyncTablePath] = useState(currentTablePath);
  const [remainingColumnPath, setRemainingColumnPath] = useState(
    initialValue?.split('.') || [],
  );
  const [selectedRelationships, setSelectedRelationships] = useState<
    { schema: string; table: string; name: string }[]
  >([]);
  const relationshipDotNotation = selectedRelationships
    .map((relationship) => relationship.name)
    .join('.');
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
      !tableData?.columns ||
      asyncTablePath !== currentTablePath
    ) {
      return;
    }

    const [activeColumn] = remainingColumnPath;

    // If there is a single column in the path, it means that we can look for it
    // in the table columns
    if (
      !tableData?.columns.some((column) => column.column_name === activeColumn)
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
  }, [
    remainingColumnPath,
    isTableLoading,
    tableData?.columns,
    asyncTablePath,
    currentTablePath,
  ]);

  useEffect(() => {
    if (
      remainingColumnPath.length < 2 ||
      isTableLoading ||
      isMetadataLoading ||
      !tableData?.columns ||
      asyncTablePath !== currentTablePath
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
      ...(tableMetadata?.object_relationships || []),
      ...(tableMetadata?.array_relationships || []),
    ].find(({ name }) => name === nextPath);

    if (!currentRelationship) {
      setRemainingColumnPath([]);
      return;
    }

    const {
      foreign_key_constraint_on: metadataConstraint,
      manual_configuration: metadataManualConfiguration,
    } = currentRelationship.using || {};

    if (metadataManualConfiguration) {
      setAsyncTablePath(
        `${metadataManualConfiguration.remote_table.schema}.${metadataManualConfiguration.remote_table.name}`,
      );

      setSelectedRelationships((currentRelationships) => [
        ...currentRelationships,
        {
          schema: metadataManualConfiguration.remote_table.schema || 'public',
          table: metadataManualConfiguration.remote_table.name,
          name: nextPath,
        },
      ]);

      setRemainingColumnPath((columnPath) => columnPath.slice(1));

      return;
    }

    // In some cases the metadata already contains the schema and table name
    if (metadataConstraint && typeof metadataConstraint !== 'string') {
      setAsyncTablePath(
        `${metadataConstraint.table.schema || 'public'}.${
          metadataConstraint.table.name
        }`,
      );

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
        const normalizedColumnName = columnName.replace(/"/g, '');
        const { foreign_key_constraint_on, manual_configuration } =
          currentRelationship.using || {};

        if (!foreign_key_constraint_on && !manual_configuration) {
          return false;
        }

        if (manual_configuration) {
          return Object.keys(manual_configuration.column_mapping).includes(
            normalizedColumnName,
          );
        }

        if (typeof foreign_key_constraint_on === 'string') {
          return foreign_key_constraint_on === normalizedColumnName;
        }

        return foreign_key_constraint_on.column === normalizedColumnName;
      },
    );

    if (!foreignKeyRelation) {
      setRemainingColumnPath([]);
      return;
    }

    const normalizedSchema = foreignKeyRelation.referencedSchema?.replace(
      /(\\"|")/g,
      '',
    );
    const normalizedTable = foreignKeyRelation.referencedTable?.replace(
      /(\\"|")/g,
      '',
    );

    setAsyncTablePath(`${normalizedSchema || 'public'}.${normalizedTable}`);

    setSelectedRelationships((currentRelationships) => [
      ...currentRelationships,
      {
        schema: normalizedSchema || 'public',
        table: normalizedTable,
        name: nextPath,
      },
    ]);

    setRemainingColumnPath((columnPath) => columnPath.slice(1));
  }, [
    currentTablePath,
    asyncTablePath,
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
    activeRelationship,
    selectedRelationships: initialized ? selectedRelationships : [],
    selectedColumn: initialized ? selectedColumn : null,
    setSelectedRelationships,
    setSelectedColumn,
    relationshipDotNotation:
      initialized && selectedRelationships?.length > 0
        ? relationshipDotNotation
        : '',
  };
}
