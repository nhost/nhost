import type { UseDataGridReturn } from '@/components/dataGrid/DataGrid';
import { useContext } from 'react';
import DataGridConfigContext from './DataGridConfigContext';

export default function useDataGridConfig<T extends object = {}>() {
  const context = useContext(DataGridConfigContext);

  if (!context) {
    throw new Error(
      `useDataGridConfig must be used within a DataGridConfigContext`,
    );
  }

  return context as unknown as UseDataGridReturn<T>;
}
