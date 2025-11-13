import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react';

type DataGridCustomizerOpenStateContextProps = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
};

const DataGridCustomizerOpenStateContext =
  createContext<DataGridCustomizerOpenStateContextProps>({
    open: false,
    setOpen: () => {},
  });

function DataGridCustomizerOpenStateProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({
      open,
      setOpen,
    }),
    [open],
  );
  return (
    <DataGridCustomizerOpenStateContext.Provider value={value}>
      {children}
    </DataGridCustomizerOpenStateContext.Provider>
  );
}

export function useDataGridCustomizerOpenStateContext() {
  const context = useContext(DataGridCustomizerOpenStateContext);
  return context;
}

export default DataGridCustomizerOpenStateProvider;
