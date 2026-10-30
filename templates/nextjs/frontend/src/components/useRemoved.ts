'use client';

import { useState } from 'react';

/**
 * The ids of items removed from a list the server rendered, for showing them
 * gone the moment they are removed.
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
