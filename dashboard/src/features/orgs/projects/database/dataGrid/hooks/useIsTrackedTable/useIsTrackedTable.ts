import { useGetTrackedTablesSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet';

export interface UseIsTrackedTableOptions {
  /**
   * The data source the table belongs to.
   */
  dataSource: string;
  /**
   * The schema the table belongs to.
   */
  schema: string;
  /**
   * The name of the table.
   */
  tableName: string;
  /**
   * Whether the query should be enabled.
   */
  enabled?: boolean;
}

/**
 * Returns whether a given table is currently tracked in Hasura metadata.
 * Composes on top of useGetTrackedTablesSet, sharing the same cached Set.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useIsTrackedTable({
  dataSource,
  schema,
  tableName,
  enabled,
}: UseIsTrackedTableOptions) {
  const { data: trackedTablesSet, ...rest } = useGetTrackedTablesSet({
    dataSource,
    queryOptions: { enabled },
  });

  return {
    ...rest,
    data: trackedTablesSet?.has(`${schema}.${tableName}`) ?? false,
  };
}
