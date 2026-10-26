'use client';

import { useState } from 'react';

/**
 * The ids of items removed from a list the server rendered, for showing them
 * gone the moment they are removed. The list only changes once
 * `router.refresh()` comes back with the page, which on a deployed backend
 * can take long enough for the item's button to be pressed again and be told
 * the item no longer exists. `restore` puts one back when the server refused.
 *
 * Never cleared: a removed id does not come back in the refreshed list, and
 * a dialog's contents start over each time it opens.
 */
export function useRemoved(): {
  removed: ReadonlySet<string>;
  remove: (id: string) => void;
  restore: (id: string) => void;
} {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());

  return {
    removed,
    remove: (id) => setRemoved((ids) => new Set(ids).add(id)),
    restore: (id) =>
      setRemoved((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      }),
  };
}
