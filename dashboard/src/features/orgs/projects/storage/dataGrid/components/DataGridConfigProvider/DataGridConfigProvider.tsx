import type { PropsWithChildren } from 'react';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import type { UseDataGridReturn } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import DataGridConfigContext from './DataGridConfigContext';

export default function DataGridConfigProvider<
  T extends UnknownDataGridRow = UnknownDataGridRow,
>({ children, ...value }: PropsWithChildren<UseDataGridReturn<T>>) {
  return (
    <DataGridConfigContext.Provider value={value as UseDataGridReturn}>
      {children}
    </DataGridConfigContext.Provider>
  );
}
