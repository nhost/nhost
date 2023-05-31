import { useContext } from 'react';
import type { DataGridCellContextProps } from './DataGridCellProvider';
import { DataGridCellContext } from './DataGridCellProvider';

export default function useDataGridCell<TInput extends HTMLElement>() {
  const context =
    useContext<DataGridCellContextProps<TInput>>(DataGridCellContext);

  return context;
}
