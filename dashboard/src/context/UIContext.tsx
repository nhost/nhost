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
   * Determines whether or not features related to project management
   * (such as project creation and project settings) are disabled.
   */
  projectManagementDisabled: boolean;
}

const initialState: UIContextState = {
  newWorkspace: false,
  modal: false,
  deleteApplicationModal: false,
  deleteWorkspaceModal: false,
  resourcesCollapsible: true,
  paymentModal: false,
  projectManagementDisabled: false,
};

export const UIContext = createContext<UIContextState>(initialState);

UIContext.displayName = 'UIContext';

function sideReducer(state: any, action: any) {
  switch (action.type) {
    case 'TOGGLE_WORKSPACES': {
      return {
        ...state,
        newWorkspace: !state.newWorkspace,
      };
    }
    case 'OPEN_MODAL': {
      return {
        ...state,
        modal: true,
      };
    }
    case 'CLOSE_MODAL': {
      return {
        ...state,
        modal: false,
      };
    }
    case 'TOGGLE_DELETE_APP_MODAL': {
      return {
        ...state,
        deleteApplicationModal: !state.deleteApplicationModal,
      };
    }
    case 'TOGGLE_DELETE_WORKSPACE_MODAL': {
      return {
        ...state,
        deleteWorkspaceModal: !state.deleteWorkspaceModal,
      };
    }
    case 'TOGGLE_RESOURCES': {
      return {
        ...state,
        resourcesCollapsible: !state.resourcesCollapsible,
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

  const openSection = () => dispatch({ type: 'TOGGLE_WORKSPACES' });
  const closeSection = () => dispatch({ type: 'TOGGLE_WORKSPACES' });
  const openModal = () => dispatch({ type: 'OPEN_MODAL' });
  const closeModal = () => dispatch({ type: 'CLOSE_MODAL' });
  const toggleResources = () => dispatch({ type: 'TOGGLE_RESOURCES' });
  const openDeleteAppModal = () =>
    dispatch({ type: 'TOGGLE_DELETE_APP_MODAL' });
  const openPaymentModal = () => dispatch({ type: 'TOGGLE_PAYMENT_MODAL' });
  const closePaymentModal = () => dispatch({ type: 'TOGGLE_PAYMENT_MODAL' });
  const closeDeleteAppModal = () =>
    dispatch({ type: 'TOGGLE_DELETE_APP_MODAL' });
  const openDeleteWorkspaceModal = () =>
    dispatch({ type: 'TOGGLE_DELETE_WORKSPACE_MODAL' });
  const closeDeleteWorkspaceModal = () =>
    dispatch({ type: 'TOGGLE_DELETE_WORKSPACE_MODAL' });

  const value = useMemo(
    () => ({
      ...state,
      openSection,
      closeSection,
      openModal,
      closeModal,
      openDeleteAppModal,
      closeDeleteAppModal,
      openDeleteWorkspaceModal,
      closeDeleteWorkspaceModal,
      toggleResources,
      openPaymentModal,
      closePaymentModal,
      projectManagementDisabled:
        process.env.NEXT_PUBLIC_PROJECT_MANAGEMENT_DISABLED === 'true',
    }),
    [state],
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
