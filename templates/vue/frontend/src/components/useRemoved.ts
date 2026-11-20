import { type Ref, shallowRef } from 'vue';

/**
 * The ids of items removed from a list the page loaded, for showing them gone
 * the moment they are removed.
 */
export function useRemoved(): {
  removed: Readonly<Ref<ReadonlySet<string>>>;
  remove: (id: string) => void;
  restore: (id: string) => void;
} {
  const removed = shallowRef<ReadonlySet<string>>(new Set());

  return {
    removed,
    remove: (id) => {
      removed.value = new Set(removed.value).add(id);
    },
    restore: (id) => {
      const next = new Set(removed.value);
      next.delete(id);
      removed.value = next;
    },
  };
}
