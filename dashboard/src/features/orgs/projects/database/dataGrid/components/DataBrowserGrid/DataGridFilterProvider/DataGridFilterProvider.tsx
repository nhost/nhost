import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import PersistenDataGrdiFilterStorage from '@/features/orgs/projects/database/dataGrid/utils/PersistentDataGridFilterStorage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

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

export type DataGridFilterOperator =
  | '$eq'
  | '$ne'
  | '$in'
  | '$nin'
  | '$gt'
  | '$lt'
  | '$gte'
  | '$lte'
  | '$like'
  | '$nlike'
  | '$ilike'
  | '$nilike'
  | '$similar'
  | '$nsimilar'
  | '$regex'
  | '$iregex'
  | '$nregex'
  | '$niregex';

export type DataGridFilter = {
  column: string;
  op: DataGridFilterOperator;
  value: string;
  id: string;
};

type DataGridFilterContextProps = {
  appliedFilters: DataGridFilter[];
  setAppliedFilters: (filters: DataGridFilter[]) => void;
  filters: DataGridFilter[];
  setFilters: (filters: DataGridFilter[]) => void;
  addFilter: (newFilter: DataGridFilter) => void;
  removeFilter: (index: number) => void;
  setValue: (index: number, newValue: string) => void;
  setColumn: (index: number, newColumn: string) => void;
  setOp: (index: number, newOp: DataGridFilterOperator) => void;
};

const DataGridFilterContext = createContext<DataGridFilterContextProps>({
  appliedFilters: [] as DataGridFilter[],
  setAppliedFilters: () => {},
  filters: [] as DataGridFilter[],
  setFilters: () => {},
  addFilter: () => {},
  removeFilter: () => {},
  setValue: () => {},
  setColumn: () => {},
  setOp: () => {},
});

function DataGridFilterProvider({ children }: PropsWithChildren) {
  const tablePath = useTablePath();
  const [appliedFilters, _setAppliedFilters] = useState<DataGridFilter[]>(() =>
    PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath),
  );
  const [filters, setFilters] = useState<DataGridFilter[]>(() =>
    PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath),
  );
  // const [loadedFiltersTablePath, setLoadedFiltersTablePath] = useState(
  //   () => tablePath,
  // );

  // const test = useRef<string | null>(null);

  function addFilter(newFilter: DataGridFilter) {
    setFilters((oldFilters) => oldFilters.concat(newFilter));
  }

  function setAppliedFilters(newFilters: DataGridFilter[]) {
    _setAppliedFilters(newFilters);
    PersistenDataGrdiFilterStorage.saveDataGridFilters(tablePath, newFilters);
  }

  useEffect(() => {
    const filtersForTheTable =
      PersistenDataGrdiFilterStorage.getDataGridFilters(tablePath);
    setFilters(filtersForTheTable);
    _setAppliedFilters(filtersForTheTable);
  }, [tablePath]);

  const contextValue: DataGridFilterContextProps = useMemo(
    () => ({
      filters,
      setFilters,
      appliedFilters,
      setAppliedFilters,
      addFilter,
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appliedFilters, filters],
  );

  return (
    <DataGridFilterContext.Provider value={contextValue}>
      {children}
    </DataGridFilterContext.Provider>
  );
}

export default DataGridFilterProvider;

export function useDataGridFilter() {
  const context = useContext(DataGridFilterContext);

  return context;
}
