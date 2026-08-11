import { InfoIcon } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

export interface MetricsCardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Label of the card.
   */
  label?: string | null;
  /**
   * Value of the card.
   */
  value?: string | null;
  /**
   * Tooltip of the card.
   */
  tooltip?: string | null;
}

export default function MetricsCard({
  label,
  value,
  tooltip,
  className,
  ...props
}: MetricsCardProps) {
  return (
    <div
      className={cn(
        'grid grid-flow-row gap-2 rounded-md bg-muted px-4 py-3',
        className,
      )}
      {...props}
    >
      <div className="grid grid-flow-col items-center justify-between gap-2">
        {label && (
          <span className="truncate font-medium text-muted-foreground">
            {label}
          </span>
        )}

        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground"
                aria-label={tooltip}
              >
                <InfoIcon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {value && <p className="truncate font-semibold text-2xl">{value}</p>}
    </div>
  );
}
