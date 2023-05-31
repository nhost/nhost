import type { CommonDialogProps } from '@/components/ui/v2/Dialog';
import type { DialogFormProps } from '@/types/common';
import type { ReactElement, ReactNode } from 'react';
import { createContext } from 'react';

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

export interface OpenDialogOptions {
  /**
   * Title of the dialog.
   */
  title?: ReactNode;
  /**
   * Component to render inside the dialog skeleton.
   */
  component: ReactElement<{
    location?: 'drawer' | 'dialog';
    onCancel?: () => void;
    onSubmit?: (args?: any) => Promise<any> | void;
  }>;
  /**
   * Props to pass to the root dialog component.
   */
  props?: Partial<CommonDialogProps>;
}

export interface DialogContextProps {
  /**
   * Call this function to open a dialog. It will automatically apply the
   * necessary functionality to the dialog.
   */
  openDialog: (options: OpenDialogOptions) => void;
  /**
   * Call this function to open a drawer. It will automatically apply the
   * necessary functionality to the drawer.
   */
  openDrawer: (options: OpenDialogOptions) => void;
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
   * Call this function to check if the form is dirty and close the active dialog
   * if the form is pristine.
   */
  closeDialogWithDirtyGuard: VoidFunction;
  /**
   * Call this function to check if the form is dirty and close the active drawer
   * if the form is pristine.
   */
  closeDrawerWithDirtyGuard: VoidFunction;
  /**
   * Call this function to close the active alert dialog.
   */
  closeAlertDialog: VoidFunction;
  /**
   * Call this function to update the dirty state of the active dialog.
   */
  onDirtyStateChange: (
    isDirty: boolean,
    location?: DialogFormProps['location'],
  ) => void;
  /**
   * Call this function to open a dirty confirmation dialog.
   */
  openDirtyConfirmation: (config?: Partial<DialogConfig<string>>) => void;
}

export default createContext<DialogContextProps>({
  openDialog: () => {},
  openDrawer: () => {},
  openAlertDialog: () => {},
  closeDialog: () => {},
  closeDrawer: () => {},
  closeDialogWithDirtyGuard: () => {},
  closeDrawerWithDirtyGuard: () => {},
  closeAlertDialog: () => {},
  onDirtyStateChange: () => {},
  openDirtyConfirmation: () => {},
});
