import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Adds the `ref` prop every component under `components/ui/` binds its
 * element to. shadcn-svelte's components expect this helper to live here, so
 * it is kept whichever UI system a project was scaffolded with.
 */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};
