import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { IndividualTreeViewState } from 'react-complex-tree';
import { useNavTreeStateFromURL } from '@/features/orgs/projects/hooks/useNavTreeStateFromURL';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

interface TreeNavStateContextType {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  mainNavPinned: boolean;
  mainNavOpenAnimationSuppressed: boolean;
  orgsTreeViewState: IndividualTreeViewState<never>;
  setOrgsTreeViewState: Dispatch<
    SetStateAction<IndividualTreeViewState<never>>
  >;
  setMainNavPinned: (value: boolean) => void;
  setMainNavOpenAnimationSuppressed: Dispatch<SetStateAction<boolean>>;
}

const TreeNavStateContext = createContext<TreeNavStateContextType | undefined>(
  undefined,
);

interface TreeNavProviderProps {
  children: ReactNode;
}

function useSyncedTreeViewState() {
  const { expandedItems, focusedItem } = useNavTreeStateFromURL();

  const [state, setState] = useState<IndividualTreeViewState>({
    expandedItems,
    focusedItem,
  });

  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      expandedItems: [
        ...new Set([...(prevState.expandedItems ?? []), ...expandedItems]),
      ],
      focusedItem,
    }));
  }, [expandedItems, focusedItem]);

  return { state, setState };
}

function TreeNavStateProvider({ children }: TreeNavProviderProps) {
  const [open, setOpen] = useState(false);
  const [mainNavOpenAnimationSuppressed, setMainNavOpenAnimationSuppressed] =
    useState(false);
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage(
    'pin-nav-tree',
    true,
  );
  const orgsTreeViewState = useSyncedTreeViewState();

  const value = useMemo(
    () => ({
      open,
      setOpen,
      mainNavPinned,
      setMainNavPinned,
      mainNavOpenAnimationSuppressed,
      setMainNavOpenAnimationSuppressed,
      orgsTreeViewState: orgsTreeViewState.state,
      setOrgsTreeViewState: orgsTreeViewState.setState,
    }),
    [
      open,
      mainNavPinned,
      mainNavOpenAnimationSuppressed,
      setMainNavPinned,
      orgsTreeViewState.state,
      orgsTreeViewState.setState,
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
