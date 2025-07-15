/**
 * This interface is used to define the basic properties of a form that is
 * rendered inside a drawer or a dialog.
 */
export interface DialogFormProps {
  /**
   * Determines whether the form is rendered inside a drawer or a dialog.
   */
  location?: 'drawer' | 'dialog';
}

export type MakeRequired<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;
