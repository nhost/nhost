import { useMemo } from 'react';

import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type {
  ForeignKeyRelation,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  MetadataRemoteRelationship,
  RelationshipViewModel,
} from '@/features/orgs/projects/database/dataGrid/types/relationships';
import buildLocalRelationshipViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel';
import buildRemoteRelationshipViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildRemoteRelationshipViewModel';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
  RemoteRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';

export interface UseGetRelationshipsProps {
  dataSource: string;
  schema: string;
  tableName: string;
}

const filterNullRelationshipViewModel = (
  item: RelationshipViewModel | null,
): item is RelationshipViewModel => item !== null;

const extractPrimaryKeyColumns = (
  tableColumns: NormalizedQueryDataRow[],
): string[] =>
  tableColumns
    .filter((column) => {
      if ('is_primary' in column && column.is_primary) {
        return true;
      }

      return (
        Array.isArray(column?.primary_constraints) &&
        column.primary_constraints.length > 0
      );
    })
    .map((column) => column.column_name as string)
    .filter(Boolean);

export default function useGetRelationships({
  dataSource,
  schema,
  tableName,
}: UseGetRelationshipsProps) {
  const {
    data: metadata,
    isLoading: isMetadataLoading,
    error: metadataError,
  } = useGetMetadata();

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`relationships.${dataSource}.${schema}.${tableName}`], {
    dataSource,
    schema,
    table: tableName,
    preventRowFetching: true,
  });

  const tableColumns = useMemo(
    () =>
      ((tableData?.columns as NormalizedQueryDataRow[] | undefined) ??
        []) as NormalizedQueryDataRow[],
    [tableData?.columns],
  );

  const primaryKeyColumns = useMemo(
    () => extractPrimaryKeyColumns(tableColumns),
    [tableColumns],
  );

  const foreignKeyRelations = useMemo(
    () =>
      (tableData?.foreignKeyRelations as ForeignKeyRelation[] | undefined) ??
      [],
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

    const arrayRelationships =
      (tableMetadataItem.array_relationships as
        | ArrayRelationshipItem[]
        | undefined) ?? [];

    const objectRelationships =
      (tableMetadataItem.object_relationships as
        | ObjectRelationshipItem[]
        | undefined) ?? [];

    const remoteRelationships =
      (tableMetadataItem.remote_relationships as
        | RemoteRelationshipItem[]
        | undefined) ?? [];

    console.table([
      arrayRelationships,
      objectRelationships,
      remoteRelationships,
    ]);

    const arrayViewModels = arrayRelationships
      .map((relationship) =>
        buildLocalRelationshipViewModel({
          relationship,
          type: 'Array',
          tableSchema: schema,
          tableName,
          dataSource,
          primaryKeyColumns,
          foreignKeyRelations,
        }),
      )
      .filter(filterNullRelationshipViewModel);

    const objectViewModels = objectRelationships
      .map((relationship) =>
        buildLocalRelationshipViewModel({
          relationship,
          type: 'Object',
          tableSchema: schema,
          tableName,
          dataSource,
          primaryKeyColumns: [],
          foreignKeyRelations,
        }),
      )
      .filter(Boolean) as RelationshipViewModel[];

    const remoteViewModels = remoteRelationships
      .map((relationship) =>
        buildRemoteRelationshipViewModel({
          relationship: relationship as MetadataRemoteRelationship,
          tableSchema: schema,
          tableName,
          dataSource,
        }),
      )
      .filter(Boolean) as RelationshipViewModel[];

    return [...arrayViewModels, ...objectViewModels, ...remoteViewModels];
  }, [
    dataSource,
    foreignKeyRelations,
    metadata,
    primaryKeyColumns,
    schema,
    tableName,
  ]);

  return {
    relationships,
    isLoading: isMetadataLoading || tableStatus === 'loading',
    error: metadataError ?? tableError,
  };
}
