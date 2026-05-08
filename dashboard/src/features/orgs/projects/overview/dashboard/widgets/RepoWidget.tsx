import { OverviewRepository } from '@/features/orgs/projects/overview/components/OverviewRepository';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';

export default function RepoWidget(_: { cfg: WidgetConfig }) {
  return <OverviewRepository />;
}
