import type { PropsWithChildren } from 'react';
import type { UnknownDataBaseRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser/dataBrowser';
import type { UseDataGridReturn } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import DataGridConfigContext from './DataGridConfigContext';

export default function DataGridConfigProvider<
  T extends UnknownDataBaseRow = UnknownDataBaseRow,
>({ children, ...value }: PropsWithChildren<UseDataGridReturn<T>>) {
  return (
    <DataGridConfigContext.Provider
      value={value as unknown as UseDataGridReturn<{}>}
    >
      {children}
    </DataGridConfigContext.Provider>
  );
}
