import { InfoIcon } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { Progress } from '@/components/ui/v3/progress';
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
  /**
   * Short extra line under the value, for example "12 active today".
   */
  detail?: string | null;
  /**
   * Optional limit for the value. Shows a bar with how much of it is used.
   */
  usage?: {
    /**
     * Used share of the limit, from 0 to 100.
     */
    percent: number;
    /**
     * Readable limit, for example "10 GB".
     */
    limitLabel: string;
  } | null;
}

export default function MetricsCard({
  label,
  value,
  tooltip,
  detail,
  usage,
  className,
  ...props
}: MetricsCardProps) {
  return (
    <div
      className={cn(
        'grid grid-flow-row content-start gap-2 bg-background px-4 py-3',
        className,
      )}
      {...props}
    >
      <div className="grid grid-flow-col items-center justify-between gap-2">
        {label && (
          <span className="truncate text-muted-foreground text-sm">
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

      {value && detail && (
        <span className="truncate text-muted-foreground text-xs">{detail}</span>
      )}

      {value && usage && (
        <div className="flex flex-col gap-1.5">
          <Progress
            value={Math.min(usage.percent, 100)}
            aria-label={`${label}: ${Math.round(usage.percent)}% of ${usage.limitLabel}`}
            className={cn(
              'h-1.5 bg-muted',
              usage.percent >= 90
                ? '[&>div]:bg-destructive'
                : usage.percent >= 75
                  ? '[&>div]:bg-warning'
                  : '[&>div]:bg-primary',
            )}
          />
          <span className="text-muted-foreground text-xs">
            {Math.round(usage.percent)}% of {usage.limitLabel}
          </span>
        </div>
      )}
    </div>
  );
}
