import { useRouter } from 'next/router';
import { type ReactNode, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
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

const PAID_PLAN_TAB_HINT = 'Available on paid plans';

export default function BillingTabs() {
  const router = useRouter();
  const { org } = useCurrentOrg();
  const activeTab: BillingTab = isBillingTab(router.query.tab)
    ? router.query.tab
    : 'plan';
  const isPaidOrg = org?.plan?.isFree === false;
  const isFreeOrg = org?.plan?.isFree === true;
  const shouldCanonicalizeUpgrade =
    Boolean(router.query.openUpgradeModal) &&
    router.query.tab !== undefined &&
    router.query.tab !== 'plan';
  const shouldLeaveRestrictedTab = isFreeOrg && activeTab !== 'plan';
  const shouldRedirectToPlan =
    shouldCanonicalizeUpgrade || shouldLeaveRestrictedTab;

  useEffect(() => {
    if (!shouldRedirectToPlan) {
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
  }, [router, shouldRedirectToPlan]);

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
        <BillingTabTrigger value="usage" restricted={isFreeOrg}>
          Usage
        </BillingTabTrigger>
        <BillingTabTrigger value="invoices" restricted={isFreeOrg}>
          Invoices
        </BillingTabTrigger>
      </TabsList>

      {!shouldRedirectToPlan && (
        <>
          <TabsContent value="plan" className="mt-4 flex flex-col gap-4">
            <SubscriptionPlan />
            {isPaidOrg && <BillingEstimate />}
          </TabsContent>
          {isPaidOrg && (
            <>
              <TabsContent value="usage" className="mt-4">
                <BillingUsageTab />
              </TabsContent>
              <TabsContent value="invoices" className="mt-4">
                <BillingInvoicesTab />
              </TabsContent>
            </>
          )}
        </>
      )}

      <FinishUpgradeOrganizationProcess />
    </Tabs>
  );
}

interface BillingTabTriggerProps {
  value: BillingTab;
  restricted: boolean;
  children: ReactNode;
}

function BillingTabTrigger({
  value,
  restricted,
  children,
}: BillingTabTriggerProps) {
  if (!restricted) {
    return <TabsTrigger value={value}>{children}</TabsTrigger>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-not-allowed">
          <TabsTrigger value={value} disabled>
            {children}
          </TabsTrigger>
        </span>
      </TooltipTrigger>
      <TooltipContent>{PAID_PLAN_TAB_HINT}</TooltipContent>
    </Tooltip>
  );
}
