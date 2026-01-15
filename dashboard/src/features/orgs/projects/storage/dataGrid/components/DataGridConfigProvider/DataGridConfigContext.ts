import { createContext } from 'react';
import type { UseDataGridReturn } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';

const DataGridConfigContext = createContext<Partial<UseDataGridReturn> | null>(
  null,
);

export default DataGridConfigContext;
