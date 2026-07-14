import type {
  CommandNode,
  PaletteOrg,
  RecentEntry,
} from '@/features/command-palette/types';
import { isNotEmptyValue } from '@/lib/utils';

export interface FallbackProject {
  orgSlug: string;
  appSubdomain: string;
  orgName?: string;
  projectName?: string;
}

interface ResolveScope {
  orgSlug?: string;
  appSubdomain?: string;
}

export const getProjectHint = (
  orgName: string | undefined,
  projectName: string | undefined,
  appSubdomain: string | undefined,
) => {
  if (!appSubdomain) {
    return orgName;
  }

  return [
    orgName,
    projectName ? `${projectName} (${appSubdomain})` : appSubdomain,
  ]
    .filter(Boolean)
    .join(' / ');
};

export const getFallbackProject = (
  recent: RecentEntry[],
  orgs: PaletteOrg[],
  currentOrgSlug?: string,
): FallbackProject | undefined => {
  const projectsByKey = new Map(
    orgs.flatMap((org) =>
      org.apps.map((app): [string, FallbackProject] => [
        `${org.slug}:${app.subdomain}`,
        {
          orgSlug: org.slug,
          appSubdomain: app.subdomain,
          orgName: org.name,
          projectName: app.name,
        },
      ]),
    ),
  );

  // `recent` is newest-first, so the first live entry is the last visit.
  const lastVisited = recent
    .map((entry) =>
      projectsByKey.get(`${entry.orgSlug ?? ''}:${entry.appSubdomain ?? ''}`),
    )
    .find(isNotEmptyValue);

  if (lastVisited) {
    return lastVisited;
  }

  const currentOrg = orgs.find((org) => org.slug === currentOrgSlug);
  const orderedOrgs = currentOrg
    ? [currentOrg, ...orgs.filter((org) => org !== currentOrg)]
    : orgs;

  for (const org of orderedOrgs) {
    const app = org.apps[0];

    if (app) {
      return {
        orgSlug: org.slug,
        appSubdomain: app.subdomain,
        orgName: org.name,
        projectName: app.name,
      };
    }
  }

  return undefined;
};

// The fallback pair is used wholesale: mixing the current org with the
// fallback project's subdomain would build a URL into the wrong org.
export const getEffectiveScope = (
  node: CommandNode,
  routeScope: ResolveScope,
  fallback?: FallbackProject,
): ResolveScope => {
  if (node.scope === 'project' && !routeScope.appSubdomain) {
    return fallback
      ? { orgSlug: fallback.orgSlug, appSubdomain: fallback.appSubdomain }
      : routeScope;
  }

  if (node.scope === 'org' && !routeScope.orgSlug) {
    return fallback ? { orgSlug: fallback.orgSlug } : routeScope;
  }

  return routeScope;
};

export const withProjectFallbackHint = (
  node: CommandNode,
  hint: string,
): CommandNode => ({
  ...node,
  hint:
    node.hint ??
    (node.scope === 'project' && node.path !== undefined ? hint : undefined),
  children: node.children?.map((child) => withProjectFallbackHint(child, hint)),
});
