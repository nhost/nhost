import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BillingUsage } from '@/features/orgs/components/billing/BillingUsage';
import { BillingUsageUnavailable } from '@/features/orgs/components/billing/BillingUsage/components/BillingUsageUnavailable';
import { BillingArea } from '@/features/orgs/components/billing/layout';
import { OrganizationScope } from '@/features/orgs/guards/OrganizationScope';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function OrgBillingUsage() {
  const { org } = useCurrentOrg();

  return (
    <div className="flex flex-col gap-4 p-4">
      {org.plan.isFree ? (
        <BillingUsageUnavailable
          heading="Usage metrics are available on paid plans"
          description="Upgrade your organization to see its usage by project."
        />
      ) : (
        <BillingUsage />
      )}
    </div>
  );
}

OrgBillingUsage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <OrganizationScope>
        <BillingArea>{page}</BillingArea>
      </OrganizationScope>
    </AppLayout>
  );
};
