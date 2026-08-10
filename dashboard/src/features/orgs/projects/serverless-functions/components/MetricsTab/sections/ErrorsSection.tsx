import MetricTable from '@/features/orgs/projects/common/metrics/components/MetricTable';
import {
  formatInteger,
  formatTimestampFull,
} from '@/features/orgs/projects/common/metrics/utils/formatters';
import ExpandablePanelCard from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/ExpandablePanelCard';
import MetricChartPanel from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricChartPanel';
import { colorForStatus } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/constants';
import type { MetricPanelSlug } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';

export interface ErrorsSectionProps {
  metrics: FunctionMetricsResponse;
  xDomain: [number, number];
  onExpand: (slug: MetricPanelSlug) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

export default function ErrorsSection({
  metrics,
  xDomain,
  onExpand,
  onZoomRange,
  onZoomOut,
}: ErrorsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <MetricChartPanel
        slug="error-rate"
        metrics={metrics}
        xDomain={xDomain}
        onExpand={onExpand}
        onZoomRange={onZoomRange}
        onZoomOut={onZoomOut}
      />

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
          rows={metrics.errors.totalErrors}
        />
      </ExpandablePanelCard>
    </div>
  );
}
