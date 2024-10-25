import { useNavTreeStateFromURL } from '@/features/orgs/projects/hooks/useNavTreeStateFromURL';
import { useWorkspacesNavTreeStateFromURL } from '@/features/orgs/projects/hooks/useWorkspacesNavTreeStateFromURL';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { IndividualTreeViewState } from 'react-complex-tree';

interface TreeNavStateContextType {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  mainNavPinned: boolean;
  orgsTreeViewState: IndividualTreeViewState<never>;
  setOrgsTreeViewState: Dispatch<
    SetStateAction<IndividualTreeViewState<never>>
  >;
  workspacesTreeViewState: IndividualTreeViewState<never>;
  setWorkspacesTreeViewState: Dispatch<
    SetStateAction<IndividualTreeViewState<never>>
  >;
  setMainNavPinned: (value: boolean) => void;
}

const TreeNavStateContext = createContext<TreeNavStateContextType | undefined>(
  undefined,
);

interface TreeNavProviderProps {
  children: ReactNode;
}

function useSyncedTreeViewState(
  useTreeStateFromURL: () => {
    expandedItems: string[];
    focusedItem: string | null;
  },
) {
  const { expandedItems, focusedItem } = useTreeStateFromURL();

  const [state, setState] = useState<IndividualTreeViewState<never>>({
    expandedItems,
    focusedItem,
    selectedItems: null,
  });

  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      expandedItems: [
        ...new Set([...prevState.expandedItems, ...expandedItems]),
      ],
      focusedItem,
    }));
  }, [expandedItems, focusedItem]);

  return { state, setState };
}

function TreeNavStateProvider({ children }: TreeNavProviderProps) {
  const [open, setOpen] = useState(false);
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage(
    'pin-nav-tree',
    true,
  );
  const orgsTreeViewState = useSyncedTreeViewState(useNavTreeStateFromURL);

  const workspacesTreeViewState = useSyncedTreeViewState(
    useWorkspacesNavTreeStateFromURL,
  );

  const value = useMemo(
    () => ({
      open,
      setOpen,
      mainNavPinned,
      setMainNavPinned,
      orgsTreeViewState: orgsTreeViewState.state,
      setOrgsTreeViewState: orgsTreeViewState.setState,
      workspacesTreeViewState: workspacesTreeViewState.state,
      setWorkspacesTreeViewState: workspacesTreeViewState.setState,
    }),
    [
      open,
      setOpen,
      mainNavPinned,
      setMainNavPinned,
      orgsTreeViewState.state,
      orgsTreeViewState.setState,
      workspacesTreeViewState.state,
      workspacesTreeViewState.setState,
    ],
  );

  return (
    <TreeNavStateContext.Provider value={value}>
      {children}
    </TreeNavStateContext.Provider>
  );
}

const useTreeNavState = (): TreeNavStateContextType => {
  const context = useContext(TreeNavStateContext);

  if (!context) {
    throw new Error(
      'useTreeNavState must be used within a TreeNavStateProvider',
    );
  }

  return context;
};

export { TreeNavStateProvider, useTreeNavState };
