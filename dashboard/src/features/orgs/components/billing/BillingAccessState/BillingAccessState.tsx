import { useId } from 'react';
import { Button } from '@/components/ui/v3/button';

export interface BillingAccessStateProps {
  heading: string;
  description: string;
  actionLabel?: string;
  onAction?: VoidFunction;
}

export default function BillingAccessState({
  heading,
  description,
  actionLabel,
  onAction,
}: BillingAccessStateProps) {
  const headingId = useId();
  const descriptionId = useId();
  const showAction = Boolean(actionLabel && onAction);

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="flex flex-col items-start gap-4 rounded-md border bg-background p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-medium text-xl">
          {heading}
        </h2>
        <p id={descriptionId} className="text-muted-foreground text-sm">
          {description}
        </p>
      </div>
      {showAction && <Button onClick={onAction}>{actionLabel}</Button>}
    </section>
  );
}
