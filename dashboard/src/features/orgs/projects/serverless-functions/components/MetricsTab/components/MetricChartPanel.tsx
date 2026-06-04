import ExpandablePanelCard from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/ExpandablePanelCard';
import MetricChart from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricChart';
import {
  METRIC_PANELS,
  type MetricPanelSlug,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import { accessorsForPanel } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/seriesAccessors';
import { formatterForKind } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';

export interface MetricChartPanelProps {
  slug: MetricPanelSlug;
  metrics: FunctionMetricsResponse;
  xDomain: [number, number];
  onExpand: (slug: MetricPanelSlug) => void;
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

// A single chart panel in a section grid. Everything it renders — title,
// description, series, accessors, value formatter — is derived from
// METRIC_PANELS[slug], the single source of truth shared with the expanded view.
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
