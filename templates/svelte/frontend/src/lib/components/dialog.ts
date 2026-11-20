import { getContext, setContext } from 'svelte';

const KEY = Symbol('close-dialog');

export function provideCloseDialog(close: VoidFunction): void {
  setContext(KEY, close);
}

/** Closes the dialog this renders inside, for a form that is done with it. */
export function useCloseDialog(): VoidFunction {
  return getContext<VoidFunction | undefined>(KEY) ?? (() => undefined);
}
