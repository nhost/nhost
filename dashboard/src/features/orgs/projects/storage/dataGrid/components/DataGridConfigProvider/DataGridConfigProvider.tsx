import type { UseDataGridReturn } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import type { PropsWithChildren } from 'react';
import DataGridConfigContext from './DataGridConfigContext';

export default function DataGridConfigProvider<T extends object = {}>({
  children,
  ...value
}: PropsWithChildren<UseDataGridReturn<T>>) {
  return (
    <DataGridConfigContext.Provider
      value={value as unknown as UseDataGridReturn<{}>}
    >
      {children}
    </DataGridConfigContext.Provider>
  );
}
