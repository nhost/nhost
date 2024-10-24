import { BillingCycle } from './components/BillingCycle';
import { SpendingWarnings } from './components/SpendingWarnings';

export default function Usage() {
  return (
    <div className="font-medium">
      <div className="flex w-full flex-col rounded-md border bg-background">
        <div className="flex w-full flex-col gap-1 p-4">
          <span>Usage</span>
        </div>
        <BillingCycle />
        <SpendingWarnings />
      </div>
    </div>
  );
}
