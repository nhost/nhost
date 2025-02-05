import type { GetFilesAggregateQuery } from '@/utils/__generated__/graphql';
import { useGetFilesAggregateQuery } from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';
import { validate as uuidValidate } from 'uuid';

export type UseFilesAggregateOptions = {
  /**
   * Search query to filter files.
   */
  searchString?: string;
  /**
   * Custom options for the query.
   */
  options?: QueryHookOptions<GetFilesAggregateQuery>;
};

export default function useFilesAggregate({
  searchString,
  options = {},
}: UseFilesAggregateOptions) {
  const isUUID = uuidValidate(searchString);
  const { data, previousData, ...rest } = useGetFilesAggregateQuery({
    variables: {
      where: searchString
        ? {
            _or: [
              ...((isUUID && [{ id: { _eq: searchString } }]) || []),
              { name: { _ilike: `%${searchString}%` } },
            ],
          }
        : null,
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
