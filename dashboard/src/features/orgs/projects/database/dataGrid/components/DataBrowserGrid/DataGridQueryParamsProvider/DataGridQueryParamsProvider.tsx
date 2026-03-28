import type { ColumnSort } from '@tanstack/react-table';
import { useRouter } from 'next/router';
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type RefObject,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import {
  getDataGridFilters,
  saveDataGridFilters,
} from '@/features/orgs/projects/database/dataGrid/utils/PersistentDataGridFilterStorage';
import type { DataGridFilterOperator } from './operators';

function compareLoadedFiltersToStorage(
  tablePath: string,
  filters: DataGridFilter[],
) {
  const filtersInStorage = JSON.stringify(getDataGridFilters(tablePath));
  const loadedFilters = JSON.stringify(filters);

  return filtersInStorage === loadedFilters;
}

export type DataGridFilter = {
  column: string;
  op: DataGridFilterOperator;
  value: string;
  id: string;
};

type DataGridQueryParamsContextProps = {
  isFiltersLoadedFromStorage: RefObject<boolean>;
  appliedFilters: DataGridFilter[];
  setAppliedFilters: (filters: DataGridFilter[]) => void;
  sortBy: ColumnSort[];
  setSortBy: Dispatch<SetStateAction<ColumnSort[]>>;
  currentOffset: number;
  setCurrentOffset: Dispatch<SetStateAction<number>>;
};

const DataGridQueryParamsContext =
  createContext<DataGridQueryParamsContextProps>({
    isFiltersLoadedFromStorage: { current: false },
    appliedFilters: [] as DataGridFilter[],
    setAppliedFilters: () => {},
    sortBy: [],
    setSortBy: () => {},
    currentOffset: 0,
    setCurrentOffset: () => {},
  });

function DataGridQueryParamsProvider({ children }: PropsWithChildren) {
  const tablePath = useTablePath();
  const {
    query: { page },
  } = useRouter();

  const [sortBy, setSortBy] = useState<ColumnSort[]>([]);
  const [currentOffset, setCurrentOffset] = useState<number>(
    parseInt(page as string, 10) - 1 || 0,
  );
  const [appliedFilters, _setAppliedFilters] = useState<DataGridFilter[]>(() =>
    getDataGridFilters(tablePath),
  );
  // NOTE: this ref will prevent fetching the table data until the filters are not loaded for the current table
  // navigating between tables
  const isFiltersLoadedFromStorage = useRef(false);

  useEffect(() => {
    const filtersForTheTable = getDataGridFilters(tablePath);
    _setAppliedFilters(filtersForTheTable);
    setSortBy([]);
  }, [tablePath]);

  isFiltersLoadedFromStorage.current = compareLoadedFiltersToStorage(
    tablePath,
    appliedFilters,
  );

  const contextValue: DataGridQueryParamsContextProps = useMemo(
    () => ({
      isFiltersLoadedFromStorage,
      appliedFilters,
      setAppliedFilters(newFilters: DataGridFilter[]) {
        _setAppliedFilters(newFilters);
        saveDataGridFilters(tablePath, newFilters);
      },
      sortBy,
      setSortBy,
      currentOffset,
      setCurrentOffset,
    }),
    [appliedFilters, sortBy, tablePath, currentOffset],
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
