import { ExternalLinkIcon } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { BillingMetricsPreview } from '@/features/orgs/components/billing/BillingMetricsPreview';
import { useCustomerPortal } from '@/features/orgs/components/billing/hooks/useCustomerPortal';
import { SubscriptionPlan } from '@/features/orgs/components/billing/SubscriptionPlan';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function BillingTabs() {
  const { org } = useCurrentOrg();
  const { openCustomerPortal, loading } = useCustomerPortal();
  const isPaidOrg = org?.plan?.isFree === false;

  // Invoices opens Stripe instead of a panel, so it's a button styled like a
  // tab that shares the tablist's pill without being part of the tablist.
  return (
    <Tabs defaultValue="plan">
      <div className="inline-flex h-10 items-center rounded-md bg-muted p-1 text-muted-foreground">
        <TabsList
          aria-label="Organization billing sections"
          className="h-auto bg-transparent p-0"
        >
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <PaidPlanHint enabled={isPaidOrg}>
            <TabsTrigger value="usage" disabled={!isPaidOrg}>
              Usage
            </TabsTrigger>
          </PaidPlanHint>
        </TabsList>
        <PaidPlanHint enabled={isPaidOrg}>
          <button
            type="button"
            onClick={openCustomerPortal}
            disabled={!isPaidOrg || loading}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Invoices
            <ExternalLinkIcon
              className="h-3.5 w-3.5"
              aria-hidden
              focusable={false}
            />
          </button>
        </PaidPlanHint>
      </div>
      <TabsContent value="plan" className="mt-4 flex flex-col gap-4">
        <SubscriptionPlan />
        {isPaidOrg && <BillingEstimate />}
      </TabsContent>
      <TabsContent value="usage" className="mt-4">
        <BillingMetricsPreview />
      </TabsContent>
    </Tabs>
  );
}

interface PaidPlanHintProps {
  enabled: boolean;
  children: ReactNode;
}

// Disabled v3 buttons and tabs set `pointer-events: none`, so they can't open a
// tooltip themselves; the wrapping span receives the hover instead.
function PaidPlanHint({ enabled, children }: PaidPlanHintProps) {
  if (enabled) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-not-allowed">{children}</span>
      </TooltipTrigger>
      <TooltipContent>Available on paid plans</TooltipContent>
    </Tooltip>
  );
}
