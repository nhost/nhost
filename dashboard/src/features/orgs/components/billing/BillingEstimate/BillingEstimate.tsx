import { Separator } from '@/components/ui/v3/separator';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { BillingCycle } from './components/BillingCycle';
import { BillingDetails } from './components/BillingDetails';
import { Estimate } from './components/Estimate';
import { SpendingNotifications } from './components/SpendingNotifications';

export default function BillingEstimate() {
  const isOrgAdmin = useIsOrgAdmin();

  return (
    <div className="">
      <div className="flex w-full flex-col rounded-md border bg-background">
        <div className="flex w-full flex-col gap-1 p-4">
          <span className="font-medium text-xl">Billing Estimate</span>
        </div>
        <div className="flex flex-col">
          <Separator />
          <BillingCycle />
          <Separator />
          <Estimate />
          <Separator />
          <SpendingNotifications />
          {isOrgAdmin && (
            <>
              <Separator />
              <BillingDetails />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
