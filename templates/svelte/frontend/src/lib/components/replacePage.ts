import { type Component, getContext, setContext } from 'svelte';

// biome-ignore lint/suspicious/noExplicitAny: any component, with its own props
export type ReplaceWith = <Props extends Record<string, any>>(
  page: Component<Props>,
  props: Props,
) => void;

const KEY = Symbol('replace-page');

export function provideReplacePage(replace: ReplaceWith): void {
  setContext(KEY, replace);
}

/**
 * What a form calls to put something in place of the page it is on, such as the
 * card that says a password change worked.
 */
export function useReplacePage(): ReplaceWith {
  const replace = getContext<ReplaceWith | undefined>(KEY);
  if (!replace) {
    throw new Error('This has to render inside ReplacePageLayout.');
  }
  return replace;
}
