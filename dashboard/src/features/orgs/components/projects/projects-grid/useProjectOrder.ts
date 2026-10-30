import { useCallback, useEffect, useMemo, useState } from 'react';

interface OrderedProject {
  id: string;
  createdAt: string;
}

function storageKey(orgSlug: string) {
  return `projectOrder:${orgSlug}`;
}

function readOrder(orgSlug: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(orgSlug)) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/**
 * The order of an organization's project cards. Projects the user dragged keep
 * their spot (saved in this browser, per organization); the rest follow,
 * oldest first, so a card never jumps when a project changes state.
 */
export default function useProjectOrder<T extends OrderedProject>(
  orgSlug: string | undefined,
  projects: T[],
) {
  const [savedOrder, setSavedOrder] = useState<string[]>([]);

  useEffect(() => {
    setSavedOrder(orgSlug ? readOrder(orgSlug) : []);
  }, [orgSlug]);

  const ordered = useMemo(() => {
    const position = new Map(savedOrder.map((id, index) => [id, index]));
    return [...projects].sort((a, b) => {
      const pa = position.get(a.id);
      const pb = position.get(b.id);
      if (pa !== undefined && pb !== undefined) {
        return pa - pb;
      }
      if (pa !== undefined) {
        return -1;
      }
      if (pb !== undefined) {
        return 1;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [projects, savedOrder]);

  const saveOrder = useCallback(
    (ids: string[]) => {
      setSavedOrder(ids);
      if (!orgSlug) {
        return;
      }
      try {
        localStorage.setItem(storageKey(orgSlug), JSON.stringify(ids));
      } catch {
        // Private mode or storage full: the order still holds until a reload.
      }
    },
    [orgSlug],
  );

  return [ordered, saveOrder] as const;
}
