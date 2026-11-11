import { Separator } from '@/components/ui/v3/separator';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Status_Enum } from '@/generated/graphql';
import { BillingCycle } from './components/BillingCycle';
import { BillingDetails } from './components/BillingDetails';
import { Estimate } from './components/Estimate';
import { SpendingNotifications } from './components/SpendingNotifications';

export default function BillingEstimate() {
  const isOrgAdmin = useIsOrgAdmin();
  const { org } = useCurrentOrg();
  // A cancelled subscription has no billing cycle or spending to track.
  const isCancelled = org?.status === Organization_Status_Enum.Cancelled;

  return (
    <div className="">
      <div className="flex w-full flex-col rounded-md border bg-background">
        <div className="flex w-full flex-col gap-1 p-4">
          <span className="font-medium text-xl">Billing Estimate</span>
        </div>
        <div className="flex flex-col">
          {!isCancelled && (
            <>
              <Separator />
              <BillingCycle />
            </>
          )}
          <Separator />
          <Estimate />
          {!isCancelled && (
            <>
              <Separator />
              <SpendingNotifications />
            </>
          )}
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
