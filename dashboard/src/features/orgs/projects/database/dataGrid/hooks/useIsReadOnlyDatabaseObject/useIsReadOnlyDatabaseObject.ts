import type { UseQueryOptions } from '@tanstack/react-query';
import type { FetchDatabaseReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';

export interface UseIsReadOnlyDatabaseObjectOptions {
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
 * Returns whether the given database object is read-only (a view,
 * materialized view, or foreign table).
 *
 * @param options - Options to use for the query.
 * @returns Whether the object is read-only.
 */
export default function useIsReadOnlyDatabaseObject({
  dataSource,
  schema,
  name,
  queryOptions,
}: UseIsReadOnlyDatabaseObjectOptions) {
  const { data: databaseData } = useDatabaseQuery([dataSource], {
    dataSource,
    queryOptions,
  });

  return (databaseData?.tableLikeObjects ?? []).some(
    (obj) =>
      obj.table_schema === schema &&
      obj.table_name === name &&
      (obj.table_type === 'VIEW' ||
        obj.table_type === 'MATERIALIZED VIEW' ||
        obj.table_type === 'FOREIGN TABLE'),
  );
}
