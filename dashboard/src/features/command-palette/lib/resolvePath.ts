import type { CommandNode } from '@/features/command-palette/types';

interface ResolvePathContext {
  orgSlug?: string;
  appSubdomain?: string;
}

export const getQueryString = (
  value: string | string[] | undefined,
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const isExternalNode = (node: CommandNode) => node.scope === 'external';

// Only drops empty segments (e.g. Overview's path: ''); segments never carry
// leading or trailing slashes.
const joinPath = (...segments: Array<string | undefined>) =>
  segments.filter(Boolean).join('/');

export const resolvePath = (
  node: CommandNode,
  { orgSlug, appSubdomain }: ResolvePathContext,
): string | undefined => {
  if (node.path === undefined) {
    return undefined;
  }

  if (isExternalNode(node)) {
    return node.path;
  }

  if (node.scope === 'org') {
    return orgSlug ? joinPath('/orgs', orgSlug, node.path) : undefined;
  }

  if (node.scope === 'project') {
    if (!orgSlug || !appSubdomain) {
      return undefined;
    }

    return joinPath('/orgs', orgSlug, 'projects', appSubdomain, node.path);
  }

  return node.path;
};
