import type { ComponentType } from 'react';
import type {
  WidgetConfig,
  WidgetType,
} from '@/features/orgs/projects/overview/dashboard/types';
import DeploysWidget from '@/features/orgs/projects/overview/dashboard/widgets/DeploysWidget';
import FeaturesDocsWidget from '@/features/orgs/projects/overview/dashboard/widgets/FeaturesDocsWidget';
import FrameworksDocsWidget from '@/features/orgs/projects/overview/dashboard/widgets/FrameworksDocsWidget';
import HealthWidget from '@/features/orgs/projects/overview/dashboard/widgets/HealthWidget';
import InfoWidget from '@/features/orgs/projects/overview/dashboard/widgets/InfoWidget';
import LogsWidget from '@/features/orgs/projects/overview/dashboard/widgets/LogsWidget';
import MetricWidget from '@/features/orgs/projects/overview/dashboard/widgets/MetricWidget';
import RepoWidget from '@/features/orgs/projects/overview/dashboard/widgets/RepoWidget';

export type WidgetRendererProps = { cfg: WidgetConfig };

export const WIDGET_RENDERERS: Record<
  WidgetType,
  ComponentType<WidgetRendererProps>
> = {
  metric: MetricWidget,
  deploys: DeploysWidget,
  'frameworks-docs': FrameworksDocsWidget,
  'features-docs': FeaturesDocsWidget,
  health: HealthWidget,
  info: InfoWidget,
  repo: RepoWidget,
  logs: LogsWidget,
};
