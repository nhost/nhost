import { Divider } from '@/components/ui/v2/Divider';
import { BillingCycle } from './components/BillingCycle';
import { BillingDetails } from './components/BillingDetails';
import { Estimate } from './components/Estimate';
import { SpendingNotifications } from './components/SpendingNotifications';

export default function BillingEstimate() {
  return (
    <div className="">
      <div className="flex w-full flex-col rounded-md border bg-background">
        <div className="flex w-full flex-col gap-1 p-4">
          <span className="text-xl font-medium">Billing Estimate</span>
        </div>
        <div className="flex flex-col">
          <Divider />
          <BillingCycle />
          <Divider />
          <Estimate />
          <Divider />
          <SpendingNotifications />
          <Divider />
          <BillingDetails />
        </div>
      </div>
    </div>
  );
}
