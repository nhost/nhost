import type { UrlObject } from 'node:url';

function normalizePath(path: string) {
  return path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

function getQueryString(href: string) {
  const withoutHash = href.split('#')[0];
  const queryStart = withoutHash.indexOf('?');
  return queryStart === -1 ? '' : withoutHash.slice(queryStart + 1);
}

function toSearchParams(query: UrlObject['query']) {
  if (typeof query === 'string') {
    return new URLSearchParams(query);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      params.append(key, String(item ?? ''));
    }
  }
  return params;
}

export function isQueryActive(
  currentQuery: UrlObject['query'],
  targetQuery: UrlObject['query'],
) {
  const current = toSearchParams(currentQuery);
  const target = toSearchParams(targetQuery);

  return Array.from(new Set(target.keys())).every((key) => {
    const currentValues = current.getAll(key);
    const targetValues = target.getAll(key);
    return (
      currentValues.length === targetValues.length &&
      targetValues.every((value, index) => value === currentValues[index])
    );
  });
}

export function isRouteActive(asPath: string, href: string, exact = false) {
  const currentPath = normalizePath(asPath);
  const targetPath = normalizePath(href);

  return (
    (currentPath === targetPath ||
      (!exact && currentPath.startsWith(`${targetPath}/`))) &&
    (!exact || isQueryActive(getQueryString(asPath), getQueryString(href)))
  );
}
