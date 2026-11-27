import { type InjectionKey, inject, type Ref, shallowRef } from 'vue';

export type ShowToast = (message: string) => VoidFunction;
export type Toast = { id: number; message: string };

export const SHOW_TOAST: InjectionKey<ShowToast> = Symbol('showToast');
export const CURRENT_TOAST: InjectionKey<Readonly<Ref<Toast | undefined>>> =
  Symbol('currentToast');

/** Shows `message` briefly at the foot of the window. */
export function useToast(): ShowToast {
  return inject(SHOW_TOAST, () => () => undefined);
}

/** The toast showing now, for `ToastStatus`. */
export function useCurrentToast(): Readonly<Ref<Toast | undefined>> {
  return inject(CURRENT_TOAST, shallowRef(undefined), false);
}
