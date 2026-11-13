import { ExternalLinkIcon } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Button } from '@/components/ui/v3/button';
import { RouteTabSeparator } from '@/components/ui/v3/route-tabs';
import { useCustomerPortal } from '@/features/orgs/components/billing/hooks/useCustomerPortal';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import BillingRouteTabs from './BillingRouteTabs';

/**
 * The frame of the organization billing pages: their route tabs and, on a
 * paid plan, the Invoices button, then the page below them in a region that
 * scrolls on its own so the tabs stay in view.
 */
export default function BillingArea({ children }: PropsWithChildren) {
  const { org } = useCurrentOrg();

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b p-4 md:gap-6 md:py-3">
        <BillingRouteTabs />
        {!org.plan.isFree && (
          <>
            <RouteTabSeparator className="hidden md:block" />
            <InvoicesButton />
          </>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function InvoicesButton() {
  const { openCustomerPortal, loading } = useCustomerPortal();

  return (
    <Button
      variant="subtle"
      size="xs"
      className="-ml-2 text-muted-foreground dark:text-sidebar-foreground"
      onClick={openCustomerPortal}
      disabled={loading}
    >
      Invoices
      <ExternalLinkIcon
        className="ml-1.5 size-3.5"
        aria-hidden
        focusable={false}
      />
    </Button>
  );
}
