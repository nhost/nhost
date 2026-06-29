import type { CommandNode } from '@/features/command-palette/types';

type QueryValue = string | string[] | undefined;

export interface ResolvePathContext {
  orgSlug?: QueryValue;
  appSubdomain?: QueryValue;
}

const getQueryString = (value: QueryValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const joinPath = (...segments: Array<string | undefined>) =>
  segments
    .filter((segment): segment is string => Boolean(segment))
    .map((segment, index) => {
      if (index === 0) {
        return segment.replace(/\/+$/g, '');
      }

      return segment.replace(/^\/+|\/+$/g, '');
    })
    .join('/');

export const resolvePath = (
  node: CommandNode,
  { orgSlug, appSubdomain }: ResolvePathContext,
): string | undefined => {
  if (node.path === undefined) {
    return undefined;
  }

  if (node.scope === 'external' || node.kind === 'doc') {
    return node.path;
  }

  const resolvedOrgSlug = getQueryString(orgSlug);
  const resolvedAppSubdomain = getQueryString(appSubdomain);

  if (node.scope === 'org') {
    return resolvedOrgSlug
      ? joinPath('/orgs', resolvedOrgSlug, node.path)
      : undefined;
  }

  if (node.scope === 'project') {
    if (!resolvedOrgSlug || !resolvedAppSubdomain) {
      return undefined;
    }

    if (node.id === 'project-settings-general') {
      return joinPath(
        '/orgs',
        resolvedOrgSlug,
        'projects',
        resolvedAppSubdomain,
        'settings',
      );
    }

    return joinPath(
      '/orgs',
      resolvedOrgSlug,
      'projects',
      resolvedAppSubdomain,
      node.path,
    );
  }

  return node.path;
};
