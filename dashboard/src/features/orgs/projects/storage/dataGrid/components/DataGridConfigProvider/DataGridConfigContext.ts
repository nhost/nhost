import type { UseDataGridReturn } from '@/components/dataGrid/DataGrid';
import { createContext } from 'react';

const DataGridConfigContext = createContext<Partial<UseDataGridReturn>>(null);

export default DataGridConfigContext;
