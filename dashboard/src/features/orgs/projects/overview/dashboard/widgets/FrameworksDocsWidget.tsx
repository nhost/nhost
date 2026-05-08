import { OverviewDocumentation } from '@/features/orgs/projects/overview/components/OverviewDocumentation';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';
import { frameworks } from '@/features/orgs/projects/overview/frameworks';

export default function FrameworksDocsWidget(_: { cfg: WidgetConfig }) {
  return (
    <OverviewDocumentation
      title="Pick your favorite framework and start learning"
      description="Nhost integrates smoothly with all of the frameworks you already know."
      cardElements={frameworks}
    />
  );
}
