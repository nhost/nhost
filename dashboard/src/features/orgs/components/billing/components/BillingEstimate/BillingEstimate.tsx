import { Divider } from '@/components/ui/v2/Divider';
import { BillingCycle } from './components/BillingCycle';
import { BillingDetails } from './components/BillingDetails';
import { SpendingWarnings } from './components/SpendingWarnings';

export default function BillingEstimate() {
  return (
    <div className="font-medium">
      <div className="flex w-full flex-col rounded-md border bg-background">
        <div className="flex w-full flex-col gap-1 p-4">
          <span className="text-xl font-medium">Billing Estimate</span>
        </div>
        <div className="flex flex-col">
          <Divider />
          <BillingCycle />
          <Divider />
          <SpendingWarnings />
          <Divider />
          <BillingDetails />
        </div>
      </div>
    </div>
  );
}
