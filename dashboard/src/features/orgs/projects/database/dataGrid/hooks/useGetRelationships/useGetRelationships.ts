import { useMemo } from 'react';

import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
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
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`${dataSource}.${schema}.${tableName}`], {
    dataSource,
    schema,
    table: tableName,
    preventRowFetching: true,
  });

  const foreignKeyRelations = useMemo(
    () => tableData?.foreignKeyRelations ?? [],
    [tableData?.foreignKeyRelations],
  );

  const relationships = useMemo(() => {
    if (!metadata) {
      return [] as RelationshipViewModel[];
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

    // console.table([
    //   arrayRelationships,
    //   objectRelationships,
    //   remoteRelationships,
    // ]);

    const arrayViewModels = arrayRelationships.map((relationship) =>
      buildLocalRelationshipViewModel({
        relationship,
        type: 'Array',
        tableSchema: schema,
        tableName,
        dataSource,
        foreignKeyRelations,
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
  }, [dataSource, foreignKeyRelations, metadata, schema, tableName]);

  return {
    relationships,
    isLoading: isMetadataLoading || tableStatus === 'loading',
    error: metadataError ?? tableError,
  };
}
