import { useRouter } from 'next/router';
import { useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { BillingEstimate } from '@/features/orgs/components/billing/BillingEstimate';
import { BillingInvoicesTab } from '@/features/orgs/components/billing/BillingTabs/components/BillingInvoicesTab';
import { BillingUsageTab } from '@/features/orgs/components/billing/BillingTabs/components/BillingUsageTab';
import {
  type BillingTab,
  isBillingTab,
} from '@/features/orgs/components/billing/BillingTabs/types';
import { FinishUpgradeOrganizationProcess } from '@/features/orgs/components/billing/FinishUpgradeOrganizationProcess';
import { SubscriptionPlan } from '@/features/orgs/components/billing/SubscriptionPlan';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function BillingTabs() {
  const router = useRouter();
  const { org } = useCurrentOrg();
  const activeTab: BillingTab = isBillingTab(router.query.tab)
    ? router.query.tab
    : 'plan';
  const isPaidOrg = !org?.plan?.isFree;
  const shouldCanonicalizeUpgrade =
    Boolean(router.query.openUpgradeModal) &&
    router.query.tab !== undefined &&
    router.query.tab !== 'plan';

  useEffect(() => {
    if (!shouldCanonicalizeUpgrade) {
      return;
    }

    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: 'plan' },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [router, shouldCanonicalizeUpgrade]);

  const handleTabChange = (newTab: string) => {
    if (!isBillingTab(newTab)) {
      return;
    }

    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: newTab },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList aria-label="Organization billing sections">
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
      </TabsList>

      {!shouldCanonicalizeUpgrade && (
        <>
          <TabsContent value="plan" className="mt-4 flex flex-col gap-4">
            <SubscriptionPlan />
            {isPaidOrg && <BillingEstimate />}
          </TabsContent>
          <TabsContent value="usage" className="mt-4">
            <BillingUsageTab isPaidOrg={isPaidOrg} />
          </TabsContent>
          <TabsContent value="invoices" className="mt-4">
            <BillingInvoicesTab isPaidOrg={isPaidOrg} />
          </TabsContent>
        </>
      )}

      <FinishUpgradeOrganizationProcess />
    </Tabs>
  );
}
