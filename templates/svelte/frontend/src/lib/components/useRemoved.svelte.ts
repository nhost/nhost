import { SvelteSet } from 'svelte/reactivity';

/**
 * The ids of items removed from a list the server rendered, for showing them
 * gone the moment they are removed.
 */
export function useRemoved(): {
  removed: ReadonlySet<string>;
  remove: (id: string) => void;
  restore: (id: string) => void;
} {
  const removed = new SvelteSet<string>();

  return {
    removed,
    remove: (id) => {
      removed.add(id);
    },
    restore: (id) => {
      removed.delete(id);
    },
  };
}
