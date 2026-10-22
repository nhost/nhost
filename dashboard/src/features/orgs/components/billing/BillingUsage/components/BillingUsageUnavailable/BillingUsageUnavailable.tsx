import { Button } from '@/components/ui/v3/button';

export interface BillingUsageUnavailableProps {
  heading: string;
  description: string;
  onRetry?: VoidFunction;
}

export default function BillingUsageUnavailable({
  heading,
  description,
  onRetry,
}: BillingUsageUnavailableProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-xl">{heading}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}
