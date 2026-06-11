import MetricChartPanel from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricChartPanel';
import type { MetricPanelSlug } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';

const CHART_SLUGS: MetricPanelSlug[] = [
  'response-time-max',
  'response-time-p95',
  'response-time-p75',
  'response-time-avg',
];

export interface ResponseTimesSectionProps {
  metrics: FunctionMetricsResponse;
  xDomain: [number, number];
  onExpand: (slug: MetricPanelSlug) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

export default function ResponseTimesSection({
  metrics,
  xDomain,
  onExpand,
  onZoomRange,
  onZoomOut,
}: ResponseTimesSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {CHART_SLUGS.map((slug) => (
        <MetricChartPanel
          key={slug}
          slug={slug}
          metrics={metrics}
          xDomain={xDomain}
          onExpand={onExpand}
          onZoomRange={onZoomRange}
          onZoomOut={onZoomOut}
        />
      ))}
    </div>
  );
}
