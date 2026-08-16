import { OverviewProjectHealth } from '@/features/orgs/projects/overview/components/OverviewProjectHealth';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';

export default function HealthWidget(_: { cfg: WidgetConfig }) {
  return <OverviewProjectHealth />;
}
