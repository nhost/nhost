import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/providers/Auth';

export const DEFAULT_ORGANIZATION_STORAGE_KEY_PREFIX =
  'nhost:defaultOrganization:';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getDefaultOrganizationStorageKey(userId: string): string {
  return `${DEFAULT_ORGANIZATION_STORAGE_KEY_PREFIX}${userId}`;
}

function readDefaultOrgId(userId: string | undefined): string | null {
  if (!userId) {
    return null;
  }

  try {
    const value = localStorage.getItem(
      getDefaultOrganizationStorageKey(userId),
    );
    return value && UUID_PATTERN.test(value) ? value : null;
  } catch (error) {
    console.error('Failed to read the default organization:', error);
    return null;
  }
}

function writeDefaultOrgId(userId: string, orgId: string | null): void {
  const key = getDefaultOrganizationStorageKey(userId);

  if (orgId === null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, orgId);
  }

  // The browser only fires `storage` in other tabs, so notify this one too.
  try {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue: orgId,
        storageArea: localStorage,
      }),
    );
  } catch (error) {
    console.error('Failed to notify the default organization change:', error);
  }
}

// `key === null` means the whole storage was cleared from another tab.
function subscribe(onChange: VoidFunction): VoidFunction {
  function handleStorage(event: StorageEvent) {
    if (
      event.key === null ||
      event.key.startsWith(DEFAULT_ORGANIZATION_STORAGE_KEY_PREFIX)
    ) {
      onChange();
    }
  }

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export interface UseDefaultOrganizationReturnType {
  /**
   * ID of the organization the dashboard opens on sign in, as stored in this
   * browser. It may point to an organization the user no longer belongs to,
   * so callers match it against their organizations.
   */
  defaultOrgId: string | null;
  /**
   * `false` until the stored value can be read: on the server, during
   * hydration, and while the user is unknown.
   */
  isReady: boolean;
  /**
   * Throws when storage can't be written.
   */
  setDefaultOrgId: (orgId: string) => void;
  /**
   * Throws when storage can't be written.
   */
  clearDefaultOrg: VoidFunction;
}

/**
 * The default organization is a personal preference saved per user in this
 * browser, by organization ID so renaming a slug keeps it.
 */
export default function useDefaultOrganization(): UseDefaultOrganizationReturnType {
  const { user } = useAuth();
  const userId = user?.id;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const defaultOrgId = useSyncExternalStore(
    subscribe,
    () => readDefaultOrgId(userId),
    () => null,
  );

  const setDefaultOrgId = useCallback(
    (orgId: string) => {
      if (!userId) {
        throw new Error('Cannot save a default organization without a user.');
      }
      if (!UUID_PATTERN.test(orgId)) {
        throw new Error(`Invalid organization ID: ${orgId}`);
      }
      writeDefaultOrgId(userId, orgId);
    },
    [userId],
  );

  const clearDefaultOrg = useCallback(() => {
    if (!userId) {
      throw new Error('Cannot clear a default organization without a user.');
    }
    writeDefaultOrgId(userId, null);
  }, [userId]);

  return {
    defaultOrgId: isMounted ? defaultOrgId : null,
    isReady: isMounted && Boolean(userId),
    setDefaultOrgId,
    clearDefaultOrg,
  };
}
