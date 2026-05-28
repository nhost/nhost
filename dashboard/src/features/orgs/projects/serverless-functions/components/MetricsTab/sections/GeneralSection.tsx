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
  formatBytes,
  formatInteger,
  formatTimestampFull,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import type {
  MetricPanelResponse,
  RequestsTableRow,
} from '@/features/orgs/projects/serverless-functions/types';

export interface GeneralSectionProps {
  invocationsByMethod: MetricPanelResponse;
  responseStatus: MetricPanelResponse;
  averageResponseSize: MetricPanelResponse;
  totalRequests: RequestsTableRow[];
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

const statusKey = (labels: Record<string, string>) =>
  `s${labels.status ?? 'unknown'}`;
const statusLabel = (_key: string, labels: Record<string, string>) =>
  labels.status ?? 'unknown';
const statusColor = (_key: string, labels: Record<string, string>) =>
  colorForStatus(labels.status ?? '');

export default function GeneralSection({
  invocationsByMethod,
  responseStatus,
  averageResponseSize,
  totalRequests,
  xDomain,
  onExpand,
  onZoomRange,
  onZoomOut,
}: GeneralSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ExpandablePanelCard
        slug={METRIC_PANELS.invocations.slug}
        title={METRIC_PANELS.invocations.title}
        description={METRIC_PANELS.invocations.description}
        onExpand={onExpand}
      >
        <MetricChart
          data={invocationsByMethod}
          seriesKeyFor={methodKey}
          seriesLabelFor={methodLabel}
          colorFor={methodColor}
          valueFormatter={formatInteger}
          xDomain={xDomain}
          onZoomRange={onZoomRange}
          onZoomOut={onZoomOut}
        />
      </ExpandablePanelCard>

      <ExpandablePanelCard
        slug={METRIC_PANELS['response-status'].slug}
        title={METRIC_PANELS['response-status'].title}
        description={METRIC_PANELS['response-status'].description}
        onExpand={onExpand}
      >
        <MetricChart
          data={responseStatus}
          seriesKeyFor={statusKey}
          seriesLabelFor={statusLabel}
          colorFor={statusColor}
          valueFormatter={formatInteger}
          xDomain={xDomain}
          onZoomRange={onZoomRange}
          onZoomOut={onZoomOut}
        />
      </ExpandablePanelCard>

      <ExpandablePanelCard
        slug={METRIC_PANELS['avg-response-size'].slug}
        title={METRIC_PANELS['avg-response-size'].title}
        onExpand={onExpand}
      >
        <MetricChart
          data={averageResponseSize}
          seriesKeyFor={methodKey}
          seriesLabelFor={methodLabel}
          colorFor={methodColor}
          valueFormatter={formatBytes}
          xDomain={xDomain}
          onZoomRange={onZoomRange}
          onZoomOut={onZoomOut}
        />
      </ExpandablePanelCard>

      <ExpandablePanelCard title="Total Requests" expandable={false}>
        <MetricTable
          rowKey={(row) => `${row.timestamp}:${row.method}`}
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
              key: 'value',
              label: 'Value',
              alignRight: true,
              render: (row) => formatInteger(row.value),
            },
          ]}
          rows={totalRequests}
        />
      </ExpandablePanelCard>
    </div>
  );
}
