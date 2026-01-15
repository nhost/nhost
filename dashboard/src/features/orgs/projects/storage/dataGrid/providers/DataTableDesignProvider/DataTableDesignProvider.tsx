import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { RowDensity } from '@/features/orgs/projects/common/types/dataTableConfigurationTypes';
import PersistenDataTableConfigurationStorage from '@/features/orgs/projects/storage/dataGrid/utils/PersistenDataTableConfigurationStorage';

type DataTableDesign = {
  setRowDensity: (newDensity: RowDensity) => void;
  rowDensity: RowDensity;
};

const DataTableDesignContext = createContext<DataTableDesign>({
  rowDensity: 'comfortable',
  setRowDensity: () => {},
});

function DataTableDesignProvider({ children }: PropsWithChildren) {
  const [rowDensity, setRowDensity] = useState<RowDensity>(
    () =>
      PersistenDataTableConfigurationStorage.getDataTableViewConfiguration()
        ?.rowDensity ?? 'comfortable',
  );

  const contextValue: DataTableDesign = useMemo(
    () => ({
      rowDensity,
      setRowDensity: (newRowDensity: RowDensity) => {
        PersistenDataTableConfigurationStorage.saveRowDensity(newRowDensity);
        setRowDensity(newRowDensity);
      },
    }),
    [rowDensity],
  );
  return (
    <DataTableDesignContext.Provider value={contextValue}>
      {children}
    </DataTableDesignContext.Provider>
  );
}

export default DataTableDesignProvider;

export function useDataTableDesignContext() {
  const context = useContext(DataTableDesignContext);

  return context;
}
