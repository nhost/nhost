import { useGetEnumsSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetEnumsSet';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';

export interface UseTableIsEnumQueryOptions {
  table: QualifiedTable;
  dataSource: string;
  enabled?: boolean;
}

/**
 * Returns whether a given table is currently marked as an enum in Hasura metadata.
 * Composes on top of useGetEnumsSet, sharing the same cached Set.
 *
 * @param options - Options to use for the query.
 * @returns True if the table is an enum, false otherwise.
 */
export default function useTableIsEnumQuery({
  table,
  dataSource,
  enabled,
}: UseTableIsEnumQueryOptions) {
  const { data: enumsSet, ...rest } = useGetEnumsSet({
    dataSource,
    queryOptions: { enabled },
  });

  return {
    ...rest,
    data: enumsSet?.has(`${table.schema}.${table.name}`) ?? false,
  };
}
