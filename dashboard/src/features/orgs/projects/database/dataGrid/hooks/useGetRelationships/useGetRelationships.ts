import { useMemo } from 'react';

import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import { useSuggestRelationshipsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import type { RelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships';
import { buildLocalRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel';
import { buildRemoteRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/utils/buildRemoteRelationshipViewModel';

export interface UseGetRelationshipsProps {
  dataSource: string;
  schema: string;
  tableName: string;
}

interface UseGetRelationshipsResult {
  relationships: RelationshipViewModel[];
  isLoading: boolean;
  error: Error | unknown;
}

export default function useGetRelationships({
  dataSource,
  schema,
  tableName,
}: UseGetRelationshipsProps): UseGetRelationshipsResult {
  const {
    data: metadata,
    isLoading: isMetadataLoading,
    error: metadataError,
  } = useGetMetadata();

  const {
    data: suggestions,
    isLoading: isSuggestionsLoading,
    error: suggestionsError,
  } = useSuggestRelationshipsQuery(dataSource, { schema, name: tableName });

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableSchemaQuery([`${dataSource}.${schema}.${tableName}`], {
    dataSource,
    schema,
    table: tableName,
  });

  const foreignKeyRelations = useMemo(
    () => tableData?.foreignKeyRelations ?? [],
    [tableData?.foreignKeyRelations],
  );

  const tableSuggestions = useMemo(
    () =>
      suggestions?.relationships?.filter(
        (suggestion) =>
          suggestion.from?.table?.name === tableName &&
          suggestion.from?.table?.schema === schema,
      ) ?? [],
    [schema, suggestions?.relationships, tableName],
  );

  const relationships = useMemo(() => {
    if (!metadata) {
      return [] satisfies RelationshipViewModel[];
    }

    const sourceMetadata = metadata.sources?.find(
      (source) => source.name === dataSource,
    );

    const tableMetadataItem = sourceMetadata?.tables?.find(
      (item) => item.table.name === tableName && item.table.schema === schema,
    );

    if (!tableMetadataItem) {
      return [];
    }

    const arrayRelationships = tableMetadataItem.array_relationships ?? [];

    const objectRelationships = tableMetadataItem.object_relationships ?? [];

    const remoteRelationships = tableMetadataItem.remote_relationships ?? [];

    const arrayViewModels = arrayRelationships.map((relationship) =>
      buildLocalRelationshipViewModel({
        relationship,
        type: 'Array',
        tableSchema: schema,
        tableName,
        dataSource,
        foreignKeyRelations,
        suggestedRelationships: tableSuggestions,
      }),
    );

    const objectViewModels = objectRelationships.map((relationship) =>
      buildLocalRelationshipViewModel({
        relationship,
        type: 'Object',
        tableSchema: schema,
        tableName,
        dataSource,
        foreignKeyRelations,
        suggestedRelationships: tableSuggestions,
      }),
    );

    const remoteViewModels = remoteRelationships.map((relationship) =>
      buildRemoteRelationshipViewModel({
        relationship,
        tableSchema: schema,
        tableName,
        dataSource,
      }),
    );

    return [...arrayViewModels, ...objectViewModels, ...remoteViewModels];
  }, [
    dataSource,
    foreignKeyRelations,
    metadata,
    schema,
    tableSuggestions,
    tableName,
  ]);

  return {
    relationships,
    isLoading:
      isMetadataLoading || tableStatus === 'loading' || isSuggestionsLoading,
    error: metadataError ?? tableError ?? suggestionsError,
  };
}
