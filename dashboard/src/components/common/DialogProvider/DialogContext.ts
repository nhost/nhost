import type { CommonDialogProps } from '@/ui/v2/Dialog';
import type { ReactNode } from 'react';
import { createContext } from 'react';

/**
 * Available dialog types.
 */
export type DialogType =
  | 'CREATE_RECORD'
  | 'CREATE_COLUMN'
  | 'EDIT_COLUMN'
  | 'CREATE_TABLE'
  | 'EDIT_TABLE'
  | 'EDIT_PERMISSIONS'
  | 'CREATE_FOREIGN_KEY'
  | 'EDIT_FOREIGN_KEY'
  | 'CREATE_ROLE'
  | 'EDIT_ROLE'
  | 'CREATE_PERMISSION_VARIABLE'
  | 'EDIT_PERMISSION_VARIABLE'
  | 'CREATE_ENVIRONMENT_VARIABLE'
  | 'EDIT_ENVIRONMENT_VARIABLE';

export interface DialogConfig<TPayload = unknown> {
  /**
   * Title of the dialog.
   */
  title: ReactNode;
  /**
   * Props to pass to the dialog component.
   */
  props?: Partial<CommonDialogProps>;
  /**
   * Payload of the dialog. (e.g: record to create, message to display, etc.)
   */
  payload?: TPayload;
}

export interface DialogContextProps {
  /**
   * Call this function to open a dialog.
   */
  openDialog: <TPayload = unknown>(
    type: DialogType,
    config?: DialogConfig<TPayload>,
  ) => void;
  /**
   * Call this function to open a drawer.
   */
  openDrawer: <TPayload = unknown>(
    type: DialogType,
    config?: DialogConfig<TPayload>,
  ) => void;
  /**
   * Call this function to open an alert dialog.
   */
  openAlertDialog: <TPayload = string>(config?: DialogConfig<TPayload>) => void;
  /**
   * Call this function to close the active dialog.
   */
  closeDialog: VoidFunction;
  /**
   * Call this function to close the active drawer.
   */
  closeDrawer: VoidFunction;
  /**
   * Call this function to close the active alert dialog.
   */
  closeAlertDialog: VoidFunction;
  /**
   * Call this function to update the dirty state of the active dialog.
   */
  onDirtyStateChange: (
    isDirty: boolean,
    location?: 'drawer' | 'dialog',
  ) => void;
}

export default createContext<DialogContextProps>({
  openDialog: () => {},
  openDrawer: () => {},
  openAlertDialog: () => {},
  closeDialog: () => {},
  closeDrawer: () => {},
  closeAlertDialog: () => {},
  onDirtyStateChange: () => {},
});
