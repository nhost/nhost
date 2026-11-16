import { useMemo } from 'react';

import { flattenTree } from '@/features/command-palette/lib/flatten';
import { getProjectHint } from '@/features/command-palette/lib/hints';
import { toScoredNode } from '@/features/command-palette/lib/machine';
import type {
  CommandNode,
  RecentEntry,
  ScoredNode,
} from '@/features/command-palette/types';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { Org } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';

const NO_ITEMS: ScoredNode[] = [];

const createRecentNode = (
  entry: RecentEntry,
  originalNode: CommandNode,
  hint?: string,
): CommandNode => ({
  ...originalNode,
  id: `recent:${entry.nodeId}:${entry.orgSlug ?? ''}:${entry.appSubdomain ?? ''}`,
  title: entry.title,
  hint,
  commandPalette: {
    originalNode,
    orgSlug: entry.orgSlug,
    appSubdomain: entry.appSubdomain,
  },
});

const recentScopeExists = (
  recentEntry: RecentEntry,
  availableOrganizations: Set<string>,
  availableProjects: Set<string>,
) => {
  if (!recentEntry.appSubdomain) {
    return availableOrganizations.has(recentEntry.orgSlug ?? '');
  }

  return availableProjects.has(
    `${recentEntry.orgSlug ?? ''}:${recentEntry.appSubdomain}`,
  );
};

export function useRecentItems(
  tree: CommandNode,
  recent: RecentEntry[],
  enabled: boolean,
  orgs: Org[],
  currentOrgSlug: string | undefined,
) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  return useMemo(() => {
    if (!enabled) {
      return NO_ITEMS;
    }

    const availableOrganizations = new Set(orgs.map((org) => org.slug));
    const availableProjects = new Set(
      orgs.flatMap((org) =>
        org.apps.map((app) => `${org.slug}:${app.subdomain}`),
      ),
    );

    if (project?.subdomain) {
      availableProjects.add(`${currentOrgSlug ?? ''}:${project.subdomain}`);
    }

    const nodesById = new Map(flattenTree(tree).map((node) => [node.id, node]));
    const orgNamesBySlug = new Map(orgs.map((org) => [org.slug, org.name]));
    const projectNamesBySlugAndSubdomain = new Map(
      orgs.flatMap((org) =>
        org.apps.map((app) => [`${org.slug}:${app.subdomain}`, app.name]),
      ),
    );

    return recent
      .filter((entry) =>
        recentScopeExists(entry, availableOrganizations, availableProjects),
      )
      .map((entry) => {
        const originalNode = nodesById.get(entry.nodeId);

        if (!originalNode) {
          return undefined;
        }

        const hint = isPlatform
          ? getProjectHint(
              orgNamesBySlug.get(entry.orgSlug ?? '') ?? entry.orgSlug,
              projectNamesBySlugAndSubdomain.get(
                `${entry.orgSlug ?? ''}:${entry.appSubdomain ?? ''}`,
              ),
              entry.appSubdomain,
            )
          : undefined;

        return toScoredNode(createRecentNode(entry, originalNode, hint));
      })
      .filter(isNotEmptyValue);
  }, [
    enabled,
    isPlatform,
    orgs,
    project?.subdomain,
    recent,
    currentOrgSlug,
    tree,
  ]);
}
