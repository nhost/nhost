import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import type {
  DataGridFilter,
  DataGridFilterOperator,
} from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import PersistenDataGrdiFilterStorage from '@/features/orgs/projects/database/dataGrid/utils/PersistentDataGridFilterStorage';

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

type DataGridFiltersContextProps = {
  filters: DataGridFilter[];
  setFilters: (filters: DataGridFilter[]) => void;
  addFilter: (newFilter: DataGridFilter) => void;
  removeFilter: (index: number) => void;
  setValue: (index: number, newValue: string) => void;
  setColumn: (index: number, newColumn: string) => void;
  setOp: (index: number, newOp: DataGridFilterOperator) => void;
};

const DataGridFiltersContext = createContext<DataGridFiltersContextProps>({
  filters: [] as DataGridFilter[],
  setFilters: () => {},
  addFilter: () => {},
  removeFilter: () => {},
  setValue: () => {},
  setColumn: () => {},
  setOp: () => {},
});

function DataGridFiltersProvider({ children }: PropsWithChildren) {
  const tablePath = useTablePath();
  const [filters, setFilters] = useState<DataGridFilter[]>(() =>
    PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath),
  );

  useEffect(() => {
    const filtersForTheTable =
      PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath);
    setFilters(filtersForTheTable);
  }, [tablePath]);

  const contextValue: DataGridFiltersContextProps = useMemo(
    () => ({
      filters,
      setFilters,
      addFilter(newFilter: DataGridFilter) {
        setFilters((oldFilters) => oldFilters.concat(newFilter));
      },
      removeFilter(index: number) {
        setFilters((oldFilters) => oldFilters.filter((_, i) => index !== i));
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
    }),
    [filters],
  );

  return (
    <DataGridFiltersContext.Provider value={contextValue}>
      {children}
    </DataGridFiltersContext.Provider>
  );
}

export default DataGridFiltersProvider;

export function useDataGridFilters() {
  const context = useContext(DataGridFiltersContext);

  return context;
}
