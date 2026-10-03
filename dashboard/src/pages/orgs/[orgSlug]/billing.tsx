import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { BillingTabs } from '@/features/orgs/components/billing/BillingTabs';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function OrgBilling() {
  const { loading } = useCurrentOrg();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-accent-background p-4">
      <BillingTabs />
    </div>
  );
}

OrgBilling.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout isOrgPage>{page}</OrgLayout>;
};
