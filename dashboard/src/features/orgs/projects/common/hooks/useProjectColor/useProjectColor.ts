import { useCallback, useEffect, useState } from 'react';
import {
  defaultColorFor,
  getColorEntry,
  isProjectColorName,
  type ProjectColorEntry,
  type ProjectColorName,
} from '@/features/orgs/projects/common/utils/projectColor';

const STORAGE_PREFIX = 'project-color:';

const storageKey = (appId: string) => `${STORAGE_PREFIX}${appId}`;

const readStored = (appId: string): ProjectColorName | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(appId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return isProjectColorName(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export type UseProjectColorReturn = {
  color: ProjectColorName | null;
  entry: ProjectColorEntry | null;
  setColor: (color: ProjectColorName) => void;
};

export function getProjectColorEntry(appId: string): ProjectColorEntry {
  const stored = readStored(appId);
  return getColorEntry(stored ?? defaultColorFor(appId));
}

export default function useProjectColor(
  appId: string | undefined,
): UseProjectColorReturn {
  const [stored, setStored] = useState<ProjectColorName | null>(() =>
    appId ? readStored(appId) : null,
  );

  useEffect(() => {
    setStored(appId ? readStored(appId) : null);
  }, [appId]);

  useEffect(() => {
    if (!appId || typeof window === 'undefined') {
      return undefined;
    }
    const target = storageKey(appId);
    const handler = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }
      if (event.key !== target) {
        return;
      }
      setStored(readStored(appId));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [appId]);

  const setColor = useCallback(
    (next: ProjectColorName) => {
      if (!appId || typeof window === 'undefined') {
        return;
      }
      const target = storageKey(appId);
      const value = JSON.stringify(next);
      try {
        window.localStorage.setItem(target, value);
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: target,
            newValue: value,
            storageArea: window.localStorage,
          }),
        );
        setStored(next);
      } catch (error) {
        console.error('Error saving project color:', error);
      }
    },
    [appId],
  );

  if (!appId) {
    return { color: null, entry: null, setColor };
  }

  const resolved: ProjectColorName = stored ?? defaultColorFor(appId);
  return {
    color: resolved,
    entry: getColorEntry(resolved),
    setColor,
  };
}
