import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export interface UpgradePlanLink {
  isFreeOrganization: boolean;
  href?: string;
}

export function useUpgradePlanLink(): UpgradePlanLink {
  const { org } = useCurrentOrg();

  return {
    isFreeOrganization: !!org?.plan?.isFree,
    href: org?.slug
      ? `/orgs/${org.slug}/billing?openUpgradeModal=true`
      : undefined,
  };
}
