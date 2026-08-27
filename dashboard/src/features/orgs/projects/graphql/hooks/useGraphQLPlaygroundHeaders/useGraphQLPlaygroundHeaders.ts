import type { Storage } from '@graphiql/toolkit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

const DASHBOARD_HEADERS_STORAGE_PREFIX = 'nhost_graphql_playground_headers:';
const GRAPHIQL_STORAGE_PREFIX = 'graphiql:';
const LEGACY_HEADERS_STORAGE_KEY = 'graphiql:headers';

interface GraphQLPlaygroundHeaders {
  headerClearVersion: number;
  headerText: string;
  headersTabOverrides: Record<string, unknown>;
  setHeaderText: (headers: string) => void;
  storage: Storage;
}

function parseHeaderText(headers: string): Record<string, unknown> | null {
  if (!headers) {
    return {};
  }

  try {
    const parsedHeaders: unknown = JSON.parse(headers);

    if (
      typeof parsedHeaders !== 'object' ||
      parsedHeaders === null ||
      Array.isArray(parsedHeaders)
    ) {
      return null;
    }

    return parsedHeaders as Record<string, unknown>;
  } catch {
    return null;
  }
}

function migrateLegacyHeaders(storageKey: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const legacyHeaders = window.localStorage.getItem(
      LEGACY_HEADERS_STORAGE_KEY,
    );

    if (legacyHeaders === null) {
      return;
    }

    if (
      legacyHeaders !== '' &&
      window.localStorage.getItem(storageKey) === null
    ) {
      window.localStorage.setItem(storageKey, JSON.stringify(legacyHeaders));
    }

    window.localStorage.removeItem(LEGACY_HEADERS_STORAGE_KEY);
  } catch (error) {
    console.error('Error migrating GraphQL playground headers:', error);
  }
}

function createGraphiQLStorage(
  headersStorageKey: string,
  onClearHeaders: VoidFunction,
): Storage {
  const localStorage =
    typeof window === 'undefined' ? null : window.localStorage;
  const shouldClear = (key: string) =>
    key.startsWith(GRAPHIQL_STORAGE_PREFIX) ||
    key.startsWith(DASHBOARD_HEADERS_STORAGE_PREFIX);

  return {
    clear: () => {
      if (!localStorage) {
        return;
      }

      const keys = Object.keys(localStorage);
      const dashboardHeaders = keys
        .filter((key) => key.startsWith(DASHBOARD_HEADERS_STORAGE_PREFIX))
        .map((key) => [key, localStorage.getItem(key)] as const);

      if (!dashboardHeaders.some(([key]) => key === headersStorageKey)) {
        dashboardHeaders.push([headersStorageKey, null]);
      }

      for (const key of keys) {
        if (shouldClear(key)) {
          localStorage.removeItem(key);
        }
      }

      for (const [key, oldValue] of dashboardHeaders) {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: null,
            oldValue,
            storageArea: localStorage,
          }),
        );
      }

      onClearHeaders();
    },
    get length() {
      return localStorage
        ? Object.keys(localStorage).filter(shouldClear).length
        : 0;
    },
    getItem: (key) => localStorage?.getItem(key) ?? null,
    removeItem: (key) => localStorage?.removeItem(key),
    setItem: (key, value) => localStorage?.setItem(key, value),
  };
}

export default function useGraphQLPlaygroundHeaders(
  appSubdomain: string,
): GraphQLPlaygroundHeaders {
  const [storageKey] = useState(() => {
    const projectStorageKey = `${DASHBOARD_HEADERS_STORAGE_PREFIX}${appSubdomain}`;
    migrateLegacyHeaders(projectStorageKey);

    return projectStorageKey;
  });
  const [storedHeaderText, setStoredHeaderText, removeStoredHeaderText] =
    useSSRLocalStorage(storageKey, '');
  const setHeaderText = useCallback(
    (headers: string) => {
      if (headers === '') {
        removeStoredHeaderText();
        return;
      }

      setStoredHeaderText(headers);
    },
    [removeStoredHeaderText, setStoredHeaderText],
  );
  const [headerClearVersion, setHeaderClearVersion] = useState(0);
  const handleClearHeaders = useCallback(() => {
    setHeaderClearVersion((version) => version + 1);
  }, []);
  const storage = useMemo(
    () => createGraphiQLStorage(storageKey, handleClearHeaders),
    [handleClearHeaders, storageKey],
  );
  const [headersTabOverrides, setHeadersTabOverrides] = useState<
    Record<string, unknown>
  >(() => parseHeaderText(storedHeaderText) ?? {});
  const previousHeaderText = useRef(storedHeaderText);

  useEffect(() => {
    if (previousHeaderText.current === storedHeaderText) {
      return;
    }

    previousHeaderText.current = storedHeaderText;
    const parsedHeaders = parseHeaderText(storedHeaderText);

    if (parsedHeaders !== null) {
      setHeadersTabOverrides(parsedHeaders);
    }
  }, [storedHeaderText]);

  return {
    headerClearVersion,
    headerText: storedHeaderText,
    headersTabOverrides,
    setHeaderText,
    storage,
  };
}
