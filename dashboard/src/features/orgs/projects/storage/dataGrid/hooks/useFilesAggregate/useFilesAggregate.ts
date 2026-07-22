import type { QueryHookOptions } from '@apollo/client';
import type {
  Files_Bool_Exp,
  GetFilesAggregateQuery,
} from '@/generated/graphql';
import { useGetFilesAggregateQuery } from '@/generated/graphql';

export type UseFilesAggregateOptions = {
  /**
   * Hasura where clause to filter files.
   */
  where?: Files_Bool_Exp;
  /**
   * Custom options for the query.
   */
  options?: QueryHookOptions<GetFilesAggregateQuery>;
};

export default function useFilesAggregate({
  where,
  options = {},
}: UseFilesAggregateOptions) {
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
