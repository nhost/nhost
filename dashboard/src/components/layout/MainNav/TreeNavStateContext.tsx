import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
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
  setOpen: (open: boolean) => void;
  mainNavPinned: boolean;
  mainNavOpenAnimationSuppressed: boolean;
  orgsTreeViewState: IndividualTreeViewState<never>;
  setOrgsTreeViewState: Dispatch<
    SetStateAction<IndividualTreeViewState<never>>
  >;
  setMainNavPinned: (value: boolean) => void;
  unpinNav: VoidFunction;
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
  const [open, setOpenState] = useState(false);
  const [mainNavOpenAnimationSuppressed, setMainNavOpenAnimationSuppressed] =
    useState(false);
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage(
    'pin-nav-tree',
    true,
  );
  const orgsTreeViewState = useSyncedTreeViewState();

  // Closing through any path re-arms the suppressed open animation.
  const setOpen = useCallback((nextOpen: boolean) => {
    setOpenState(nextOpen);

    if (!nextOpen) {
      setMainNavOpenAnimationSuppressed(false);
    }
  }, []);

  // Unpinning swaps the pinned nav for the overlay in place, so the overlay
  // must appear already open instead of sliding in.
  const unpinNav = useCallback(() => {
    setMainNavOpenAnimationSuppressed(true);
    setOpenState(true);
    setMainNavPinned(false);
  }, [setMainNavPinned]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      mainNavPinned,
      setMainNavPinned,
      mainNavOpenAnimationSuppressed,
      unpinNav,
      orgsTreeViewState: orgsTreeViewState.state,
      setOrgsTreeViewState: orgsTreeViewState.setState,
    }),
    [
      open,
      setOpen,
      mainNavPinned,
      mainNavOpenAnimationSuppressed,
      setMainNavPinned,
      unpinNav,
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
