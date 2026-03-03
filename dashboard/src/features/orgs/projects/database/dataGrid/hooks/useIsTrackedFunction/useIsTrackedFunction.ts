import { useGetTrackedFunctionsSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedFunctionsSet';

export interface UseIsTrackedFunctionOptions {
  /**
   * The data source the function belongs to.
   */
  dataSource: string;
  /**
   * The schema the function belongs to.
   */
  schema: string;
  /**
   * The name of the function.
   */
  functionName: string;
  /**
   * Whether the query should be enabled.
   */
  enabled?: boolean;
}

/**
 * Returns whether a given function is currently tracked in Hasura metadata.
 * Composes on top of useGetTrackedFunctionsSet, sharing the same cached Set.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useIsTrackedFunction({
  dataSource,
  schema,
  functionName,
  enabled,
}: UseIsTrackedFunctionOptions) {
  const { data: trackedFunctionsSet, ...rest } = useGetTrackedFunctionsSet({
    dataSource,
    queryOptions: { enabled },
  });

  return {
    ...rest,
    data: trackedFunctionsSet?.has(`${schema}.${functionName}`) ?? false,
  };
}
