import type { UseDataGridReturn } from '@/components/dataGrid/DataGrid';
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
