import type { Storage as GraphiQLStorage } from '@graphiql/toolkit';
import { withoutDuplicateRuns } from '@/features/orgs/projects/graphql/common/utils/groupHistory';

// GraphiQL prefixes every key it stores with this namespace.
const NAMESPACE = 'graphiql:';

// History entries GraphiQL keeps in the browser. It saves the request
// headers with each one, which can hold tokens, so they are dropped first.
// Repeated runs of the same query are saved once.
const HISTORY_KEYS = ['queries', 'favorites'];

// Keys the playground used to share across every project. They can hold
// queries, variables and headers from any project.
const SHARED_KEYS = [
  'query',
  'variables',
  'headers',
  'operationName',
  'tabState',
  'queries',
  'favorites',
];

function withoutHistoryHeaders(name: string, value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const items = parsed[name];

    if (!Array.isArray(items)) {
      return value;
    }

    return JSON.stringify({
      [name]: withoutDuplicateRuns(
        items.map((item) => ({ ...item, headers: undefined })),
      ),
    });
  } catch {
    return value;
  }
}

/**
 * GraphiQL storage for one project: tabs, history and starred queries are kept
 * per project, and request headers are never written to the browser.
 */
export function createPlaygroundStorage(
  projectId: string,
  storage: Storage = window.localStorage,
): GraphiQLStorage {
  const prefix = `${NAMESPACE}${projectId}:`;

  const toProjectKey = (key: string) =>
    prefix + (key.startsWith(NAMESPACE) ? key.slice(NAMESPACE.length) : key);

  const projectKeys = () =>
    Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key) => key !== null)
      .filter((key) => key.startsWith(prefix));

  return {
    getItem: (key) => storage.getItem(toProjectKey(key)),
    setItem: (key, value) => {
      const projectKey = toProjectKey(key);
      const name = projectKey.slice(prefix.length);

      if (name === 'headers') {
        storage.removeItem(projectKey);
        return;
      }

      storage.setItem(
        projectKey,
        HISTORY_KEYS.includes(name)
          ? withoutHistoryHeaders(name, value)
          : value,
      );
    },
    removeItem: (key) => storage.removeItem(toProjectKey(key)),
    clear: () => {
      for (const key of projectKeys()) {
        storage.removeItem(key);
      }
    },
    get length() {
      return projectKeys().length;
    },
  };
}

/**
 * Removes what the playground stored before it was per project, so headers
 * saved back then don't stay in the browser.
 */
export function removeSharedPlaygroundStorage(
  storage: Storage = window.localStorage,
) {
  for (const name of SHARED_KEYS) {
    storage.removeItem(`${NAMESPACE}${name}`);
  }
}
