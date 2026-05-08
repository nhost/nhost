import { OverviewDeployments } from '@/features/orgs/projects/overview/components/OverviewDeployments';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';

export default function DeploysWidget(_: { cfg: WidgetConfig }) {
  return <OverviewDeployments />;
}
