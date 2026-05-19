import type { ReactElement, ReactNode } from 'react';
import { createContext } from 'react';
import type { CommonDialogProps } from '@/components/ui/v2/Dialog';
import type { DialogFormProps } from '@/types/common';

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
    onCancel?: (event?: unknown) => void;
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    onSubmit?: (args?: any) => Promise<any>;
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
  openAlertDialog: <TPayload = string>(config: DialogConfig<TPayload>) => void;
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
   * if the form is pristine. The optional `event` lets the guard skip the
   * unsaved-changes confirmation when triggered by a form submission.
   */
  closeDialogWithDirtyGuard: (event?: unknown) => void;
  /**
   * Call this function to check if the form is dirty and close the active drawer
   * if the form is pristine. The optional `event` lets the guard skip the
   * unsaved-changes confirmation when triggered by a form submission.
   */
  closeDrawerWithDirtyGuard: (event?: unknown) => void;
  /**
   * Call this function to close the active alert dialog.
   */
  closeAlertDialog: VoidFunction;
  /**
   * Report the dirty state of a single named source. The dialog or drawer is
   * considered dirty if any registered source is dirty. `id` must be stable
   * for the lifetime of the source. Sources are dropped automatically when
   * the matching dialog/drawer closes.
   *
   * Use this when a single dialog/drawer hosts multiple independent forms
   * that each need to report their own dirty state. Pick an id prefixed by
   * feature (e.g. `edit-gql-columns`) to avoid silent collisions across
   * unrelated dialogs.
   */
  setDirtySource: (
    id: string,
    isDirty: boolean,
    location?: DialogFormProps['location'],
  ) => void;
  /**
   * Update the dirty state of the active dialog or drawer.
   *
   * @deprecated Use {@link setDirtySource} instead. The legacy API only
   * supports a single dirty signal per location, so dialogs hosting multiple
   * forms have to aggregate dirty state themselves. `setDirtySource` lets
   * each form register its own source and the provider does the aggregation.
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
  setDirtySource: () => {},
  onDirtyStateChange: () => {},
  openDirtyConfirmation: () => {},
});
