import { useMeasure } from '@uidotdev/usehooks';
import { Link2, X } from 'lucide-react';
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
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

  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop close; keyboard alternative (Esc) and explicit close button are provided
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc key is handled at the window level (useEffect below)
    <div
      className="flex min-h-0 flex-1 flex-col p-6"
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              Copy link
            </Button>
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
          {/* Mount the chart only after the first real measurement. Otherwise
              it paints once at MIN_CHART_HEIGHT and visibly jumps to full height
              when useMeasure reports the host's actual height. */}
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
