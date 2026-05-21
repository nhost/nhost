import ExpandablePanelCard from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/ExpandablePanelCard';
import MetricChart from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricChart';
import { colorForMethod } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/constants';
import { METRIC_PANELS } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import type { MetricPanelSlug } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/types';
import { formatMs } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import type { MetricPanelResponse } from '@/features/orgs/projects/serverless-functions/types';

export interface ResponseTimesSectionProps {
  max: MetricPanelResponse;
  p95: MetricPanelResponse;
  p75: MetricPanelResponse;
  avg: MetricPanelResponse;
  xDomain: [number, number];
  onExpand: (slug: MetricPanelSlug) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

const methodKey = (labels: Record<string, string>) =>
  (labels.method ?? 'all-methods').toLowerCase();
const methodLabel = (_key: string, labels: Record<string, string>) =>
  labels.method ?? 'All methods';
const methodColor = (_key: string, labels: Record<string, string>, i: number) =>
  colorForMethod(labels.method ?? '', i);

export default function ResponseTimesSection({
  max,
  p95,
  p75,
  avg,
  xDomain,
  onExpand,
  onZoomRange,
  onZoomOut,
}: ResponseTimesSectionProps) {
  const panels: Array<{
    data: MetricPanelResponse;
    slug: MetricPanelSlug;
  }> = [
    { data: max, slug: 'response-time-max' },
    { data: p95, slug: 'response-time-p95' },
    { data: p75, slug: 'response-time-p75' },
    { data: avg, slug: 'response-time-avg' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {panels.map(({ data, slug }) => {
        const cfg = METRIC_PANELS[slug];
        return (
          <ExpandablePanelCard
            key={slug}
            slug={slug}
            title={cfg.title}
            description={cfg.description}
            onExpand={onExpand}
          >
            <MetricChart
              kind="line"
              data={data}
              seriesKeyFor={methodKey}
              seriesLabelFor={methodLabel}
              colorFor={methodColor}
              valueFormatter={formatMs}
              xDomain={xDomain}
              onZoomRange={onZoomRange}
              onZoomOut={onZoomOut}
            />
          </ExpandablePanelCard>
        );
      })}
    </div>
  );
}
