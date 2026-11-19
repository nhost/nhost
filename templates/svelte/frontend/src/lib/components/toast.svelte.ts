import { getContext, setContext } from 'svelte';

type ShowToast = (message: string) => VoidFunction;
type Toast = { id: number; message: string };

const KEY = Symbol('toast');

class Toasts {
  current = $state<Toast>();
  #count = 0;

  show: ShowToast = (message) => {
    this.#count += 1;
    const id = this.#count;
    this.current = { id, message };

    return () => {
      if (this.current?.id === id) {
        this.current = undefined;
      }
    };
  };
}

/** Makes `useToast` work in every component under the caller. */
export function provideToasts(): Toasts {
  return setContext(KEY, new Toasts());
}

/** Shows `message` briefly at the foot of the window. */
export function useToast(): ShowToast {
  return getContext<Toasts | undefined>(KEY)?.show ?? (() => () => undefined);
}

/** The toast on screen now, if any. */
export function useCurrentToast(): { readonly current: Toast | undefined } {
  return getContext<Toasts | undefined>(KEY) ?? { current: undefined };
}
