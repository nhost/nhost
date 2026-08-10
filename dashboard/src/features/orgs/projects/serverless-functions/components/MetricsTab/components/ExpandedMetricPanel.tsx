import { useMeasure } from '@uidotdev/usehooks';
import { X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import MetricChart from '@/features/orgs/projects/common/metrics/components/MetricChart';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';
import { formatterForKind } from '@/features/orgs/projects/common/metrics/utils/formatters';
import {
  METRIC_PANELS,
  type MetricPanelSlug,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import { accessorsForPanel } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/seriesAccessors';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';

export interface ExpandedMetricPanelProps {
  openPanel: MetricPanelSlug;
  hiddenKeys: string[];
  metrics: FunctionMetricsResponse;
  xDomain: [number, number];
  onClose: VoidFunction;
  onHiddenKeysChange: (next: string[]) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

const MIN_CHART_HEIGHT = 320;

export default function ExpandedMetricPanel({
  openPanel,
  hiddenKeys,
  metrics,
  xDomain,
  onClose,
  onHiddenKeysChange,
  onZoomRange,
  onZoomOut,
}: ExpandedMetricPanelProps) {
  const config = METRIC_PANELS[openPanel];
  const sourceData = useMemo<MetricSeries[]>(
    () => config.select(metrics),
    [config, metrics],
  );

  const valueFormatter = formatterForKind(config.valueFormatterKind);
  const accessors = accessorsForPanel(config.labelDimensions);

  const [chartHostRef, { height }] = useMeasure<HTMLDivElement>();
  // The chart mounts only after the first real measurement (height != null).
  // Otherwise it paints once at MIN_CHART_HEIGHT and visibly jumps to full
  // height when useMeasure reports the host's actual height.
  const chartHeight = Math.max(MIN_CHART_HEIGHT, Math.round(height ?? 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shareUrl =
    typeof window === 'undefined' ? undefined : window.location.href;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col p-6">
      <button
        type="button"
        aria-label="Close expanded panel"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative flex min-h-0 flex-1 flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground text-lg">
              {config.title}
            </h2>
            {config.description ? (
              <p className="text-muted-foreground text-sm">
                {config.description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyToClipboardButton
              textToCopy={shareUrl}
              title="Link"
              aria-label="Copy link"
              className="px-3 py-2.5 text-sm"
            >
              Copy link
            </CopyToClipboardButton>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close expanded panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={chartHostRef} className="min-h-0 flex-1">
          {height != null ? (
            <MetricChart
              data={sourceData}
              height={chartHeight}
              accessors={accessors}
              valueFormatter={valueFormatter}
              xDomain={xDomain}
              onZoomRange={onZoomRange}
              onZoomOut={onZoomOut}
              hiddenKeys={hiddenKeys}
              onHiddenKeysChange={onHiddenKeysChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
