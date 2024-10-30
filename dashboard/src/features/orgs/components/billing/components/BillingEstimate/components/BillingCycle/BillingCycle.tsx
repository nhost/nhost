import { Progress } from '@/components/ui/v3/progress';
import { getBillingCycleInfo } from '@/features/orgs/components/billing/utils/getBillingCycle';

export default function BillingCycle() {
  const { progress, billingCycleStart, billingCycleEnd, daysLeft } =
    getBillingCycleInfo();

  const daysText = daysLeft === 1 ? 'day' : 'days';

  return (
    <div className="flex w-full flex-row justify-between gap-8 p-4 pb-5">
      <div className="flex basis-1/2 flex-col">
        <span className="font-medium">
          Current billing cycle ({daysLeft} {daysText} left)
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{billingCycleStart}</span>
          <span className="text-muted-foreground">{billingCycleEnd}</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>
    </div>
  );
}
