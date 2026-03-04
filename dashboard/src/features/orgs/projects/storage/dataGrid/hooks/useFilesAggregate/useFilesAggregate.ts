import type { QueryHookOptions } from '@apollo/client';
import { buildFilesWhereClause } from '@/features/orgs/projects/storage/dataGrid/utils/buildFilesWhereClause';
import type { GetFilesAggregateQuery } from '@/utils/__generated__/graphql';
import { useGetFilesAggregateQuery } from '@/utils/__generated__/graphql';

export type UseFilesAggregateOptions = {
  /**
   * Search query to filter files.
   */
  searchString?: string;
  /**
   * Bucket ID to filter files by.
   */
  bucketId?: string;
  /**
   * Custom options for the query.
   */
  options?: QueryHookOptions<GetFilesAggregateQuery>;
};

export default function useFilesAggregate({
  searchString,
  bucketId,
  options = {},
}: UseFilesAggregateOptions) {
  const where = buildFilesWhereClause({ searchString, bucketId });

  const { data, previousData, ...rest } = useGetFilesAggregateQuery({
    variables: {
      where,
    },
    ...options,
  });

  return {
    numberOfFiles:
      data?.filesAggregate?.aggregate?.count ||
      previousData?.filesAggregate?.aggregate?.count ||
      0,
    ...rest,
  };
}
