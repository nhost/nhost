import { OverviewProjectInfo } from '@/features/orgs/projects/overview/components/OverviewProjectInfo';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';

export default function InfoWidget(_: { cfg: WidgetConfig }) {
  return <OverviewProjectInfo />;
}
