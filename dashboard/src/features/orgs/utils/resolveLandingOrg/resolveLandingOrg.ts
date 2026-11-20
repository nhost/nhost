import type { Org } from '@/features/orgs/projects/hooks/useOrgs';

export interface ResolveLandingOrgOptions {
  orgs: Org[];
  defaultOrgId: string | null;
  lastSlug: string | null;
}

/**
 * Picks the organization the dashboard opens on sign in: the default
 * organization, then the last one selected in this browser, then the first
 * free one, then the first one.
 */
export default function resolveLandingOrg({
  orgs,
  defaultOrgId,
  lastSlug,
}: ResolveLandingOrgOptions): Org | undefined {
  return (
    orgs.find((org) => org.id === defaultOrgId) ??
    orgs.find((org) => org.slug === lastSlug) ??
    orgs.find((org) => org.plan.isFree) ??
    orgs[0]
  );
}
