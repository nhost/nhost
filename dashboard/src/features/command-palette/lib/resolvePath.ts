import {
  getOrgUrl,
  getProjectUrl,
} from '@/components/layout/MainNav/nav-config';
import type { CommandNode } from '@/features/command-palette/types';

interface ResolvePathContext {
  orgSlug?: string;
  appSubdomain?: string;
}

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
    return orgSlug ? joinPath(getOrgUrl(orgSlug), node.path) : undefined;
  }

  if (node.scope === 'project') {
    if (!orgSlug || !appSubdomain) {
      return undefined;
    }

    return joinPath(getProjectUrl(orgSlug, appSubdomain), node.path);
  }

  return node.path;
};
