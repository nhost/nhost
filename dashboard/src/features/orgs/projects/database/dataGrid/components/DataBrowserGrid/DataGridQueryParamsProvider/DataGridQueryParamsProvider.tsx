import type { ColumnSort } from '@tanstack/react-table';
import { useRouter } from 'next/router';
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  getDataGridFilters,
  saveDataGridFilters,
} from '@/features/orgs/projects/database/dataGrid/utils/PersistentDataGridFilterStorage';
import type { DataGridFilterOperator } from './operators';

export type DataGridFilter = {
  column: string;
  op: DataGridFilterOperator;
  value: string;
  id: string;
};

type DataGridQueryParamsContextProps = {
  appliedFilters: DataGridFilter[];
  setAppliedFilters: (filters: DataGridFilter[]) => void;
  sortBy: ColumnSort[];
  setSortBy: Dispatch<SetStateAction<ColumnSort[]>>;
  currentOffset: number;
};

const DataGridQueryParamsContext =
  createContext<DataGridQueryParamsContextProps>({
    appliedFilters: [] as DataGridFilter[],
    setAppliedFilters: () => {},
    sortBy: [],
    setSortBy: () => {},
    currentOffset: 0,
  });

type DataGridQueryParamsProviderProps = PropsWithChildren<{
  storageKey: string;
}>;

function DataGridQueryParamsProvider({
  children,
  storageKey,
}: DataGridQueryParamsProviderProps) {
  const {
    query: { page },
  } = useRouter();

  const [sortBy, setSortBy] = useState<ColumnSort[]>([]);
  const currentOffset = Math.max((parseInt(page as string, 10) || 1) - 1, 0);
  const [appliedFilters, _setAppliedFilters] = useState<DataGridFilter[]>(() =>
    getDataGridFilters(storageKey),
  );

  const contextValue: DataGridQueryParamsContextProps = useMemo(
    () => ({
      appliedFilters,
      setAppliedFilters(newFilters: DataGridFilter[]) {
        _setAppliedFilters(newFilters);
        saveDataGridFilters(storageKey, newFilters);
      },
      sortBy,
      setSortBy,
      currentOffset,
    }),
    [appliedFilters, sortBy, storageKey, currentOffset],
  );

  return (
    <DataGridQueryParamsContext.Provider value={contextValue}>
      {children}
    </DataGridQueryParamsContext.Provider>
  );
}

export default DataGridQueryParamsProvider;

export function useDataGridQueryParams() {
  const context = useContext(DataGridQueryParamsContext);

  return context;
}
