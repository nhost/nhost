import { useEffect, useState } from 'react';
import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { AutocompleteOption } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/types';
import type {
  FetchMetadataReturnType,
  ForeignKeyRelation,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import resolveRelationshipTarget, {
  type RelationshipTableTarget,
} from '@/features/orgs/projects/database/dataGrid/utils/resolveRelationshipTarget';

function resolveRelationshipTraversal({
  metadataTables,
  selectedSchema,
  selectedTable,
  relationshipName,
  foreignKeyRelations,
}: {
  metadataTables: readonly HasuraMetadataTable[];
  selectedSchema: string;
  selectedTable: string;
  relationshipName: string;
  foreignKeyRelations: readonly ForeignKeyRelation[];
}): RelationshipTableTarget | undefined {
  const metadataTable = metadataTables.find(
    ({ table }) =>
      table.schema === selectedSchema && table.name === selectedTable,
  );
  const relationship = [
    ...(metadataTable?.object_relationships ?? []),
    ...(metadataTable?.array_relationships ?? []),
  ].find(({ name }) => name === relationshipName);
  return resolveRelationshipTarget({
    using: relationship?.using,
    selectedSchema,
    selectedTable,
    foreignKeyRelations,
    metadataTables,
  });
}

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
  tableData?: FetchTableSchemaReturnType;
  /**
   * Metadata to be used to determine the initial value.
   */
  metadata?: FetchMetadataReturnType;
  /**
   * Function to be called when the input is asynchronously initialized.
   */
  onInitialized?: (value: {
    value: string;
    columnMetadata: Record<string, unknown>;
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
    initialValue ? initialValue.split('.') : [],
  );
  const [selectedRelationships, setSelectedRelationships] = useState<
    { schema: string; table: string; name: string }[]
  >([]);
  const relationshipDotNotation = selectedRelationships
    .map((relationship) => relationship.name)
    .join('.');
  const [selectedColumn, setSelectedColumn] =
    useState<AutocompleteOption | null>(null);
  const activeRelationship = selectedRelationships.at(-1);

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

    const column = tableData.columns.find(
      ({ column_name: columnName }) => columnName === activeColumn,
    );
    if (!column) {
      setRemainingColumnPath([]);
      return;
    }

    setSelectedColumn({
      value: activeColumn,
      label: activeColumn,
      group: 'columns',
      metadata: column,
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

    const [nextPath] = remainingColumnPath;
    const target = resolveRelationshipTraversal({
      metadataTables: metadata?.tables ?? [],
      selectedSchema: selectedSchema ?? 'public',
      selectedTable: selectedTable ?? '',
      relationshipName: nextPath,
      foreignKeyRelations: tableData.foreignKeyRelations ?? [],
    });
    if (!target) {
      setRemainingColumnPath([]);
      return;
    }

    setAsyncTablePath(`${target.schema}.${target.table}`);
    setSelectedRelationships((currentRelationships) => [
      ...currentRelationships,
      { ...target, name: nextPath },
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
