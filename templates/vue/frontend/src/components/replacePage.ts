import { type Component, type InjectionKey, inject } from 'vue';

export type ReplacePage = (
  page: Component,
  props?: Record<string, unknown>,
) => void;

export const REPLACE_PAGE: InjectionKey<ReplacePage> = Symbol('replacePage');

/**
 * What a form calls to put something in place of the page it is on, such as the
 * card that says a password change worked.
 */
export function useReplacePage(): ReplacePage {
  return inject(REPLACE_PAGE, () => {
    throw new Error('This has to render inside ReplacePageLayout.');
  });
}
