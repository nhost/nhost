import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import PersistenDataGrdiFilterStorage from '@/features/orgs/projects/database/dataGrid/utils/PersistentDataGridFilterStorage';
import { useRouter } from 'next/router';
import {
  createContext,
  type Dispatch,
  type MutableRefObject,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SortingRule } from 'react-table';
import type { DataGridFilterOperator } from './operators';

function updateFilterInArray(
  filters: DataGridFilter[],
  index: number,
  newValue: DataGridFilter,
) {
  return [...filters.slice(0, index), newValue, ...filters.slice(index + 1)];
}

function updateFilter(
  oldFilters: DataGridFilter[],
  index: number,
  filterKey: keyof DataGridFilter,
  newValue: string | DataGridFilterOperator,
) {
  const filter = oldFilters[index];
  const filterToUpdate = {
    ...filter,
    [filterKey]: newValue,
  };
  return updateFilterInArray(oldFilters, index, filterToUpdate);
}

function compareLoadedFiltersToStorage(
  tablePath: string,
  filters: DataGridFilter[],
) {
  const filtersInStorage = JSON.stringify(
    PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath),
  );
  const loadedFilters = JSON.stringify(filters);

  return filtersInStorage === loadedFilters;
}

export type DataGridFilter = {
  column: string;
  op: DataGridFilterOperator;
  value: string;
  id: string;
};

type DataGridQueryParamsContexProps = {
  isFiltersLoadedFromStorage: MutableRefObject<boolean>;
  appliedFilters: DataGridFilter[];
  setAppliedFilters: (filters: DataGridFilter[]) => void;
  filters: DataGridFilter[];
  setFilters: (filters: DataGridFilter[]) => void;
  addFilter: (newFilter: DataGridFilter) => void;
  removeFilter: (index: number) => void;
  setValue: (index: number, newValue: string) => void;
  setColumn: (index: number, newColumn: string) => void;
  setOp: (index: number, newOp: DataGridFilterOperator) => void;
  sortBy: SortingRule<any>[];
  setSortBy: Dispatch<SetStateAction<SortingRule<any>[]>>;
  currentOffset: number;
  setCurrentOffset: Dispatch<SetStateAction<number>>;
};

const DataGridQueryParamsContext =
  createContext<DataGridQueryParamsContexProps>({
    isFiltersLoadedFromStorage: { current: false },
    appliedFilters: [] as DataGridFilter[],
    setAppliedFilters: () => {},
    filters: [] as DataGridFilter[],
    setFilters: () => {},
    addFilter: () => {},
    removeFilter: () => {},
    setValue: () => {},
    setColumn: () => {},
    setOp: () => {},
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

  const [sortBy, setSortBy] = useState<SortingRule<any>[]>([]);
  const [currentOffset, setCurrentOffset] = useState<number>(
    parseInt(page as string, 10) - 1 || 0,
  );
  const [appliedFilters, _setAppliedFilters] = useState<DataGridFilter[]>(() =>
    PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath),
  );
  const [filters, setFilters] = useState<DataGridFilter[]>(() =>
    PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath),
  );

  const isFiltersLoadedFromStorage = useRef(false);

  useEffect(() => {
    const filtersForTheTable =
      PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath);
    setFilters(filtersForTheTable);
    _setAppliedFilters(filtersForTheTable);
    setSortBy([]);
  }, [tablePath]);

  isFiltersLoadedFromStorage.current = compareLoadedFiltersToStorage(
    tablePath,
    appliedFilters,
  );

  const contextValue: DataGridQueryParamsContexProps = useMemo(
    () => ({
      isFiltersLoadedFromStorage,
      filters,
      setFilters,
      appliedFilters,
      setAppliedFilters(newFilters: DataGridFilter[]) {
        _setAppliedFilters(newFilters);
        PersistenDataGrdiFilterStorage.saveDataGridFilters(
          tablePath,
          newFilters,
        );
      },
      addFilter(newFilter: DataGridFilter) {
        setFilters((oldFilters) => oldFilters.concat(newFilter));
      },
      removeFilter(index: number) {
        setFilters((oldFilters) => {
          const newFilters = oldFilters.filter((_, i) => index !== i);
          PersistenDataGrdiFilterStorage.saveDataGridFilters(
            tablePath,
            newFilters,
          );
          return newFilters;
        });
      },

      setColumn(index: number, newColumnValue: string) {
        setFilters((oldFilters) =>
          updateFilter(oldFilters, index, 'column', newColumnValue),
        );
      },

      setValue(index: number, newValue: string) {
        setFilters((oldFilters) =>
          updateFilter(oldFilters, index, 'value', newValue),
        );
      },

      setOp(index: number, newOp: DataGridFilterOperator) {
        setFilters((oldFilters) =>
          updateFilter(oldFilters, index, 'op', newOp),
        );
      },
      sortBy,
      setSortBy,
      currentOffset,
      setCurrentOffset,
    }),
    [appliedFilters, filters, sortBy, tablePath, currentOffset],
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
