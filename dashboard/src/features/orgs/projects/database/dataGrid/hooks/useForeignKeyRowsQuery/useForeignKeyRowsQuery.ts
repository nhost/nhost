import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { fetchForeignKeyRows } from './fetchForeignKeyRows';

export default function useForeignKeyRowsQuery(
  relation: ForeignKeyRelation,
  search: string,
  open: boolean,
) {
  const adminApi = useAdminApiTarget();
  const { query } = useRouter();
  const dataSource = query.dataSourceSlug as string;
  const schema = relation.referencedSchema || (query.schemaSlug as string);
  const table = relation.referencedTable;
  const identity = [adminApi?.appUrl, dataSource, schema, table];
  const available = Boolean(adminApi && dataSource && schema && table);
  const schemaQuery = useTableSchemaQuery(['foreign-key-schema', ...identity], {
    dataSource,
    schema,
    table,
    queryOptions: {
      enabled: open && available,
      staleTime: 60_000,
      keepPreviousData: false,
    },
  });
  const columns = schemaQuery.data?.columns.map((column) => ({
    name: column.column_name as string,
    type: (column.full_data_type ?? column.data_type) as string,
  }));
  const rowsQuery = useQuery({
    queryKey: [
      'foreign-key-rows',
      ...identity,
      relation.referencedColumns,
      columns,
      search,
    ],
    queryFn: ({ signal }) =>
      fetchForeignKeyRows({
        ...adminApi!,
        dataSource,
        schema,
        table,
        columns: columns!,
        referencedColumns: relation.referencedColumns,
        search,
        signal,
      }),
    enabled:
      open &&
      available &&
      schemaQuery.isSuccess &&
      !schemaQuery.data.error &&
      Boolean(columns?.length),
    retry: false,
    cacheTime: 0,
  });

  return {
    ...rowsQuery,
    unavailable:
      !available ||
      schemaQuery.isError ||
      Boolean(schemaQuery.data?.error) ||
      (schemaQuery.isSuccess && !columns?.length) ||
      rowsQuery.isError,
    isLoading: schemaQuery.isLoading || rowsQuery.isLoading,
  };
}
