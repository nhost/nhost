import { OverviewDocumentation } from '@/features/orgs/projects/overview/components/OverviewDocumentation';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';
import { features } from '@/features/orgs/projects/overview/features';
import { frameworks } from '@/features/orgs/projects/overview/frameworks';

type DocsWidgetProps = {
  cfg: WidgetConfig;
};

export default function DocsWidget({ cfg }: DocsWidgetProps) {
  const variant = cfg.variant ?? 'frameworks';

  if (variant === 'features') {
    return (
      <OverviewDocumentation
        title="Platform Documentation"
        description="More in-depth documentation for key features."
        cardElements={features}
      />
    );
  }

  return (
    <OverviewDocumentation
      title="Pick your favorite framework and start learning"
      description="Nhost integrates smoothly with all of the frameworks you already know."
      cardElements={frameworks}
    />
  );
}
