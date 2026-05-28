import ExpandablePanelCard from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/ExpandablePanelCard';
import MetricChart from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricChart';
import MetricTable from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricTable';
import {
  colorForMethod,
  colorForStatus,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/constants';
import { METRIC_PANELS } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import type { MetricPanelSlug } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/types';
import {
  formatInteger,
  formatPercentUnit,
  formatTimestampFull,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import type {
  ErrorsTableRow,
  MetricPanelResponse,
} from '@/features/orgs/projects/serverless-functions/types';

export interface ErrorsSectionProps {
  errorRate: MetricPanelResponse;
  totalErrors: ErrorsTableRow[];
  xDomain: [number, number];
  onExpand: (slug: MetricPanelSlug) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

const methodKey = (labels: Record<string, string>) =>
  (labels.method ?? 'unknown').toLowerCase();
const methodLabel = (_key: string, labels: Record<string, string>) =>
  labels.method ?? 'unknown';
const methodColor = (_key: string, labels: Record<string, string>, i: number) =>
  colorForMethod(labels.method ?? '', i);

export default function ErrorsSection({
  errorRate,
  totalErrors,
  xDomain,
  onExpand,
  onZoomRange,
  onZoomOut,
}: ErrorsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ExpandablePanelCard
        slug={METRIC_PANELS['error-rate'].slug}
        title={METRIC_PANELS['error-rate'].title}
        description={METRIC_PANELS['error-rate'].description}
        onExpand={onExpand}
      >
        <MetricChart
          data={errorRate}
          seriesKeyFor={methodKey}
          seriesLabelFor={methodLabel}
          colorFor={methodColor}
          valueFormatter={formatPercentUnit}
          xDomain={xDomain}
          onZoomRange={onZoomRange}
          onZoomOut={onZoomOut}
        />
      </ExpandablePanelCard>

      <ExpandablePanelCard title="Total Errors" expandable={false}>
        <MetricTable
          rowKey={(row) => `${row.timestamp}:${row.method}:${row.status}`}
          columns={[
            {
              key: 'timestamp',
              label: 'Time',
              render: (row) => (
                <span className="text-muted-foreground text-xs">
                  {formatTimestampFull(new Date(row.timestamp).getTime())}
                </span>
              ),
            },
            {
              key: 'method',
              label: 'Method',
              render: (row) => (
                <span className="font-mono text-xs">{row.method}</span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              alignRight: true,
              render: (row) => (
                <span
                  className="font-mono text-xs"
                  style={{ color: colorForStatus(row.status) }}
                >
                  {row.status}
                </span>
              ),
            },
            {
              key: 'value',
              label: 'Value',
              alignRight: true,
              render: (row) => formatInteger(row.value),
            },
          ]}
          rows={totalErrors}
        />
      </ExpandablePanelCard>
    </div>
  );
}
