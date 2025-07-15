import type { UseDataGridReturn } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { createContext } from 'react';

const DataGridConfigContext = createContext<Partial<UseDataGridReturn> | null>(
  null,
);

export default DataGridConfigContext;
