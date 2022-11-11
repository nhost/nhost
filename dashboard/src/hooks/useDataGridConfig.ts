import { DataGridContext } from '@/context/DataGridContext';
import { useContext } from 'react';
import type { UseDataGridReturn } from './useDataGrid';

export default function useDataGridConfig<T extends object = {}>() {
  const context = useContext(DataGridContext);

  if (!context) {
    throw new Error(`useDataGridConfig must be used within a DataGridContext`);
  }

  return context as unknown as UseDataGridReturn<T>;
}
