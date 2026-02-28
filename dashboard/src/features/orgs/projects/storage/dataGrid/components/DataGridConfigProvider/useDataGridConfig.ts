import { useContext } from 'react';
import type {
  UnknownDataGridRow,
  UseDataGridReturn,
} from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import DataGridConfigContext from './DataGridConfigContext';

export default function useDataGridConfig<
  T extends UnknownDataGridRow = UnknownDataGridRow,
>() {
  const context = useContext(DataGridConfigContext);

  if (!context) {
    throw new Error(
      `useDataGridConfig must be used within a DataGridConfigContext`,
    );
  }

  return context as unknown as UseDataGridReturn<T>;
}
