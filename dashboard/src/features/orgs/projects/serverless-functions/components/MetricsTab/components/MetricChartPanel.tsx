import MetricChart from '@/features/orgs/projects/common/metrics/components/MetricChart';
import { formatterForKind } from '@/features/orgs/projects/common/metrics/utils/formatters';
import ExpandablePanelCard from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/ExpandablePanelCard';
import {
  METRIC_PANELS,
  type MetricPanelSlug,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import { accessorsForPanel } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/seriesAccessors';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';

export interface MetricChartPanelProps {
  slug: MetricPanelSlug;
  metrics: FunctionMetricsResponse;
  xDomain: [number, number];
  onExpand: (slug: MetricPanelSlug) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

export default function MetricChartPanel({
  slug,
  metrics,
  xDomain,
  onExpand,
  onZoomRange,
  onZoomOut,
}: MetricChartPanelProps) {
  const config = METRIC_PANELS[slug];
  return (
    <ExpandablePanelCard
      slug={slug}
      title={config.title}
      description={config.description}
      onExpand={onExpand}
    >
      <MetricChart
        data={config.select(metrics)}
        accessors={accessorsForPanel(config.labelDimensions)}
        valueFormatter={formatterForKind(config.valueFormatterKind)}
        xDomain={xDomain}
        onZoomRange={onZoomRange}
        onZoomOut={onZoomOut}
      />
    </ExpandablePanelCard>
  );
}
