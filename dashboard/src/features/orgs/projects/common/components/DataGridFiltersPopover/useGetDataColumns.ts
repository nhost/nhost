import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { SELECTION_COLUMN_ID } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';

export function useGetDataColumns<
  T extends UnknownDataGridRow = UnknownDataGridRow,
>() {
  const { getAllColumns } = useDataGridConfig<T>();
  const columns = getAllColumns().filter(
    ({ id }) => id !== SELECTION_COLUMN_ID,
  );

  return columns;
}
