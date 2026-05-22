import { Link2 } from 'lucide-react';
import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import MetricChart from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricChart';
import {
  colorForMethod,
  colorForStatus,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/constants';
import { METRIC_PANELS } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import type { MetricPanelSlug } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/types';
import {
  formatBytes,
  formatInteger,
  formatMs,
  formatPercentUnit,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import type {
  FunctionMetricsResponse,
  MetricSeries,
} from '@/features/orgs/projects/serverless-functions/types';

export interface MetricPanelDialogProps {
  openPanel: MetricPanelSlug | null;
  hiddenKeys: string[];
  metrics: FunctionMetricsResponse | undefined;
  xDomain: [number, number];
  onClose: VoidFunction;
  onHiddenKeysChange: (next: string[]) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

export default function MetricPanelDialog({
  openPanel,
  hiddenKeys,
  metrics,
  xDomain,
  onClose,
  onHiddenKeysChange,
  onZoomRange,
  onZoomOut,
}: MetricPanelDialogProps) {
  const config = openPanel ? METRIC_PANELS[openPanel] : null;
  const sourceData = useMemo<MetricSeries[]>(() => {
    if (!openPanel || !metrics) {
      return [];
    }
    return seriesForSlug(openPanel, metrics);
  }, [openPanel, metrics]);

  const valueFormatter = useMemo(() => {
    if (!config) {
      return undefined;
    }
    switch (config.valueFormatterKind) {
      case 'integer':
        return formatInteger;
      case 'bytes':
        return formatBytes;
      case 'ms':
        return formatMs;
      case 'percent-unit':
        return formatPercentUnit;
      default:
        return undefined;
    }
  }, [config]);

  const keyKind = useMemo<'method' | 'status'>(() => {
    if (!config) {
      return 'method';
    }
    return config.labelDimensions.includes('status') &&
      !config.labelDimensions.includes('method')
      ? 'status'
      : 'method';
  }, [config]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <Dialog
      open={!!openPanel}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-w-5xl flex-col gap-4 text-foreground">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="space-y-1">
              <DialogTitle>{config?.title ?? 'Metric'}</DialogTitle>
              {config?.description ? (
                <DialogDescription>{config.description}</DialogDescription>
              ) : null}
            </div>
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
          </div>
        </DialogHeader>

        <MetricChart
          kind="line"
          data={sourceData}
          height={520}
          seriesKeyFor={
            keyKind === 'status'
              ? (labels) => `s${labels.status ?? 'unknown'}`
              : (labels) => (labels.method ?? 'all-methods').toLowerCase()
          }
          seriesLabelFor={
            keyKind === 'status'
              ? (_k, labels) => labels.status ?? 'unknown'
              : (_k, labels) => labels.method ?? 'All methods'
          }
          colorFor={
            keyKind === 'status'
              ? (_k, labels) => colorForStatus(labels.status ?? '')
              : (_k, labels, i) => colorForMethod(labels.method ?? '', i)
          }
          valueFormatter={valueFormatter}
          xDomain={xDomain}
          onZoomRange={onZoomRange}
          onZoomOut={onZoomOut}
          hiddenKeys={hiddenKeys}
          onHiddenKeysChange={onHiddenKeysChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function seriesForSlug(
  slug: MetricPanelSlug,
  metrics: FunctionMetricsResponse,
): MetricSeries[] {
  switch (slug) {
    case 'invocations':
      return metrics.general.invocationsByMethod;
    case 'response-status':
      return metrics.general.responseStatus;
    case 'avg-response-size':
      return metrics.general.averageResponseSize;
    case 'response-time-max':
      return metrics.responseTimes.max;
    case 'response-time-p95':
      return metrics.responseTimes.p95;
    case 'response-time-p75':
      return metrics.responseTimes.p75;
    case 'response-time-avg':
      return metrics.responseTimes.avg;
    case 'error-rate':
      return metrics.errors.errorRate;
    default:
      return [];
  }
}
