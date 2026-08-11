import type { UseQueryOptions } from '@tanstack/react-query';
import type { FetchDatabaseReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import type { TableLikeObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface UseTableTypeOptions {
  /**
   * The data source to query.
   */
  dataSource: string;
  /**
   * The schema of the object to check.
   */
  schema: string;
  /**
   * The name of the object to check.
   */
  name: string;
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<FetchDatabaseReturnType>;
}

/**
 * Returns the `table_type` of the given database object (e.g. `'ORDINARY
 * TABLE'`, `'VIEW'`, `'MATERIALIZED VIEW'`), or `undefined` if it cannot be
 * found in the current data source.
 */
export interface UseTableTypeReturn {
  tableType: TableLikeObjectType | undefined;
  isFetched: boolean;
  isLoading: boolean;
}

export default function useTableType({
  dataSource,
  schema,
  name,
  queryOptions,
}: UseTableTypeOptions): UseTableTypeReturn {
  const {
    data: databaseData,
    isFetched,
    isLoading,
  } = useDatabaseQuery([dataSource], {
    dataSource,
    queryOptions,
  });

  const tableType = (databaseData?.tableLikeObjects ?? []).find(
    (obj) => obj.table_schema === schema && obj.table_name === name,
  )?.table_type;

  return { tableType, isFetched, isLoading };
}
