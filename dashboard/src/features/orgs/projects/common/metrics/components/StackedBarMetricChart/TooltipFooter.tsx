import {
  formatTooltipValue,
  numericValue,
  type TooltipEntry,
} from '@/features/orgs/projects/common/metrics/components/MetricChartTooltip';
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
  return (
    <>
      {referenceLines?.map((referenceLine) => (
        <div
          key={referenceLine.label}
          className="flex items-center justify-between gap-4 border-border/50 border-t pt-1.5 leading-none"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="w-3 border-primary border-t border-dashed" />
            {referenceLine.label}
          </span>
          <span className="font-medium font-mono tabular-nums">
            {formatTooltipValue(referenceLine.value, valueFormatter)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 border-border/50 border-t pt-1.5 leading-none">
        <span className="font-medium">{totalLabel}</span>
        <span className="font-medium font-mono tabular-nums">
          {formatTooltipValue(total, valueFormatter)}
        </span>
      </div>
    </>
  );
}
