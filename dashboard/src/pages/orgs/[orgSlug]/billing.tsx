import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BillingTabs } from '@/features/orgs/components/billing/BillingTabs';
import { OrganizationScope } from '@/features/orgs/guards/OrganizationScope';

export default function OrgBilling() {
  return (
    <div className="flex min-h-full flex-col gap-4 bg-background p-4">
      <BillingTabs />
    </div>
  );
}

OrgBilling.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <OrganizationScope>{page}</OrganizationScope>
    </AppLayout>
  );
};
