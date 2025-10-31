import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type DataTableDesign = {
  hideColumnBorders: boolean;
  toggleColumnBorder: () => void;
  setRowHeight: (newHeight: string) => void;
  rowHeight: string;
};

const DataTableDesignContext = createContext<DataTableDesign>({
  hideColumnBorders: false,
  toggleColumnBorder: () => {},
  rowHeight: '48 px',
  setRowHeight: () => {},
});

function DataTableDesignProvider({ children }: PropsWithChildren) {
  const [hideColumnBorders, setHideColumnBorder] = useState(false);
  const [rowHeight, setRowHeight] = useState('3rem');

  const contextValue: DataTableDesign = useMemo(
    () => ({
      hideColumnBorders,
      toggleColumnBorder: () => setHideColumnBorder((c) => !c),
      rowHeight,
      setRowHeight,
    }),
    [hideColumnBorders, rowHeight],
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
