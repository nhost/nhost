import { Progress } from '@/components/ui/v3/progress';
import {
  formatTooltipValue,
  numericValue,
  type TooltipEntry,
} from '@/features/orgs/projects/common/metrics/components/MetricChartTooltip';
import { formatWholePercent } from '@/features/orgs/projects/common/metrics/utils/formatters';
import type { StackedBarReferenceLine } from './types';

interface TooltipFooterProps {
  entries: TooltipEntry[];
  totalLabel: string;
  referenceLines?: StackedBarReferenceLine[];
  valueFormatter?: (value: number) => string;
}

export default function TooltipFooter({
  entries,
  totalLabel,
  referenceLines,
  valueFormatter,
}: TooltipFooterProps) {
  const total = entries.reduce((sum, entry) => sum + numericValue(entry), 0);
  // A reference line is shown as how much of it the total uses, not as a row
  // with its own value, so it doesn't read as one more part of the sum.
  return (
    <>
      <div className="flex items-center justify-between gap-4 border-border/50 border-t pt-1.5 leading-none">
        <span className="font-medium">{totalLabel}</span>
        <span className="font-medium font-mono tabular-nums">
          {formatTooltipValue(total, valueFormatter)}
        </span>
      </div>
      {referenceLines?.map((referenceLine) => {
        const share = (total / referenceLine.value) * 100;
        return (
          <div key={referenceLine.label} className="mt-3 grid gap-1.5">
            <Progress value={Math.min(share, 100)} className="h-1.5" />
            <span className="text-muted-foreground">
              {formatWholePercent(share)} of {referenceLine.label}
            </span>
          </div>
        );
      })}
    </>
  );
}
