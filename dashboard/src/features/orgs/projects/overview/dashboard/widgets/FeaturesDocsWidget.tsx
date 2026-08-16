import { OverviewDocumentation } from '@/features/orgs/projects/overview/components/OverviewDocumentation';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';
import { features } from '@/features/orgs/projects/overview/features';

export default function FeaturesDocsWidget(_: { cfg: WidgetConfig }) {
  return (
    <OverviewDocumentation
      title="Platform Documentation"
      description="More in-depth documentation for key features."
      cardElements={features}
    />
  );
}
