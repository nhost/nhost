import { type InjectionKey, inject } from 'vue';

export const CLOSE_DIALOG: InjectionKey<VoidFunction> = Symbol('closeDialog');

/** Closes the dialog this renders inside, for a form that is done with it. */
export function useCloseDialog(): VoidFunction {
  return inject(CLOSE_DIALOG, () => undefined);
}
