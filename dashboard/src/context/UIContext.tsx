import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useReducer } from 'react';

export interface UIContextState {
  newWorkspace: boolean;
  modal: boolean;
  deleteApplicationModal: boolean;
  deleteWorkspaceModal: boolean;
  resourcesCollapsible: boolean;
  paymentModal: boolean;
  /**
   * Determines whether or not the dashboard is in maintenance mode.
   */
  maintenanceActive: boolean;
  /**
   * The date and time when maintenance mode will end.
   */
  maintenanceEndDate: Date;
  openPaymentModal: () => void;
  closePaymentModal: () => void;
  openDeleteWorkspaceModal: () => void;
  closeDeleteWorkspaceModal: () => void;
}

const initialState: UIContextState = {
  newWorkspace: false,
  modal: false,
  deleteApplicationModal: false,
  deleteWorkspaceModal: false,
  resourcesCollapsible: true,
  paymentModal: false,
  maintenanceActive: false,
  maintenanceEndDate: null,
  openPaymentModal: () => {},
  closePaymentModal: () => {},
  openDeleteWorkspaceModal: () => {},
  closeDeleteWorkspaceModal: () => {},
};

export const UIContext = createContext<UIContextState>(initialState);

UIContext.displayName = 'UIContext';

function sideReducer(state: any, action: any) {
  switch (action.type) {
    case 'TOGGLE_DELETE_WORKSPACE_MODAL': {
      return {
        ...state,
        deleteWorkspaceModal: !state.deleteWorkspaceModal,
      };
    }
    case 'TOGGLE_PAYMENT_MODAL': {
      return {
        ...state,
        paymentModal: !state.paymentModal,
      };
    }
    default:
      return { ...state };
  }
}

export function UIProvider(props: PropsWithChildren<unknown>) {
  const [state, dispatch] = useReducer(sideReducer, initialState);
  const router = useRouter();

  const openPaymentModal = () => dispatch({ type: 'TOGGLE_PAYMENT_MODAL' });
  const closePaymentModal = () => dispatch({ type: 'TOGGLE_PAYMENT_MODAL' });
  const openDeleteWorkspaceModal = () =>
    dispatch({ type: 'TOGGLE_DELETE_WORKSPACE_MODAL' });
  const closeDeleteWorkspaceModal = () =>
    dispatch({ type: 'TOGGLE_DELETE_WORKSPACE_MODAL' });

  const maintenanceUnlocked =
    process.env.NEXT_PUBLIC_MAINTENANCE_UNLOCK_SECRET &&
    process.env.NEXT_PUBLIC_MAINTENANCE_UNLOCK_SECRET ===
      router.query.maintenanceUnlockSecret;

  const value: UIContextState = useMemo(
    () => ({
      ...state,
      openDeleteWorkspaceModal,
      closeDeleteWorkspaceModal,
      openPaymentModal,
      closePaymentModal,
      maintenanceActive: maintenanceUnlocked
        ? false
        : process.env.NEXT_PUBLIC_MAINTENANCE_ACTIVE === 'true',
      maintenanceEndDate:
        process.env.NEXT_PUBLIC_MAINTENANCE_END_DATE &&
        !Number.isNaN(Date.parse(process.env.NEXT_PUBLIC_MAINTENANCE_END_DATE))
          ? new Date(Date.parse(process.env.NEXT_PUBLIC_MAINTENANCE_END_DATE))
          : null,
    }),
    [state, maintenanceUnlocked],
  );

  return <UIContext.Provider value={value} {...props} />;
}

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export function ManagedUIContext({ children }: PropsWithChildren<unknown>) {
  return <UIProvider>{children}</UIProvider>;
}
