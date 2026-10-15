import { linkOptions } from '@tanstack/react-router';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export function useUpgradePlanLink() {
  const { org } = useCurrentOrg();

  return {
    isFreeOrganization: !!org?.plan?.isFree,
    upgradeLink: org?.slug
      ? linkOptions({
          to: '/orgs/$orgSlug/billing',
          params: { orgSlug: org.slug },
          search: { openUpgradeModal: 'true' },
        })
      : undefined,
  };
}
