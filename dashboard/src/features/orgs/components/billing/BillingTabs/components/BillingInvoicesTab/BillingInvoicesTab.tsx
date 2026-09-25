import { ExternalLinkIcon } from 'lucide-react';
import { useId } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useCustomerPortal } from '@/features/orgs/components/billing/hooks/useCustomerPortal';

export default function BillingInvoicesTab() {
  const headingId = useId();
  const descriptionId = useId();
  const { openCustomerPortal, loading } = useCustomerPortal();

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="flex flex-col items-start gap-4 rounded-md border bg-background p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-medium text-xl">
          Invoices and billing
        </h2>
        <p id={descriptionId} className="text-muted-foreground text-sm">
          View invoices and manage billing details in the Stripe Customer
          Portal.
        </p>
      </div>
      <ButtonWithLoading
        className="gap-2"
        onClick={openCustomerPortal}
        loading={loading}
      >
        Open Stripe Customer Portal
        <ExternalLinkIcon className="h-4 w-4" aria-hidden focusable={false} />
      </ButtonWithLoading>
    </section>
  );
}
