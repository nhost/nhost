import type { ComponentType } from 'react';
import type {
  WidgetConfig,
  WidgetType,
} from '@/features/orgs/projects/overview/dashboard/types';
import DeploysWidget from '@/features/orgs/projects/overview/dashboard/widgets/DeploysWidget';
import DocsWidget from '@/features/orgs/projects/overview/dashboard/widgets/DocsWidget';
import HealthWidget from '@/features/orgs/projects/overview/dashboard/widgets/HealthWidget';
import InfoWidget from '@/features/orgs/projects/overview/dashboard/widgets/InfoWidget';
import LogsWidget from '@/features/orgs/projects/overview/dashboard/widgets/LogsWidget';
import MetricWidget from '@/features/orgs/projects/overview/dashboard/widgets/MetricWidget';
import PulseWidget from '@/features/orgs/projects/overview/dashboard/widgets/PulseWidget';
import RepoWidget from '@/features/orgs/projects/overview/dashboard/widgets/RepoWidget';

export type WidgetRendererProps = { cfg: WidgetConfig };

export const WIDGET_RENDERERS: Record<
  WidgetType,
  ComponentType<WidgetRendererProps>
> = {
  metric: MetricWidget,
  pulse: PulseWidget,
  health: HealthWidget,
  deploys: DeploysWidget,
  logs: LogsWidget,
  info: InfoWidget,
  repo: RepoWidget,
  docs: DocsWidget,
};
