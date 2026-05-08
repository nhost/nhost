import type {
  WidgetMeta,
  WidgetType,
} from '@/features/orgs/projects/overview/dashboard/types';

export const WIDGET_TYPES: Record<WidgetType, WidgetMeta> = {
  metric: {
    name: 'Single stat',
    desc: 'One key number.',
    icon: 'gauge',
    cat: 'Metrics',
    default: { w: 3, h: 3, minW: 2, minH: 2 },
  },
  pulse: {
    name: 'Project pulse',
    desc: 'Requests over time at a glance.',
    icon: 'activity',
    cat: 'Metrics',
    default: { w: 8, h: 4, minW: 5, minH: 3 },
  },
  health: {
    name: 'Project health',
    desc: 'Live status of all services.',
    icon: 'heart-pulse',
    cat: 'Services',
    default: { w: 4, h: 5, minW: 3, minH: 4 },
  },
  deploys: {
    name: 'Recent deployments',
    desc: 'Last commits and their status.',
    icon: 'git-commit',
    cat: 'Activity',
    default: { w: 6, h: 5, minW: 4, minH: 3 },
  },
  logs: {
    name: 'Recent logs',
    desc: 'Live tail of service logs.',
    icon: 'file-text',
    cat: 'Activity',
    default: { w: 6, h: 5, minW: 4, minH: 3 },
  },
  info: {
    name: 'Project info',
    desc: 'Region, subdomain.',
    icon: 'info',
    cat: 'Resources',
    default: { w: 4, h: 4, minW: 3, minH: 3 },
  },
  repo: {
    name: 'Repository',
    desc: 'Connected GitHub repo.',
    icon: 'github',
    cat: 'Resources',
    default: { w: 4, h: 3, minW: 3, minH: 2 },
  },
  docs: {
    name: 'Documentation',
    desc: 'Curated links to docs.',
    icon: 'book-open',
    cat: 'Resources',
    default: { w: 4, h: 4, minW: 3, minH: 3 },
  },
};

export function widgetTitle(
  type: WidgetType,
  cfg: { metric?: string } | undefined,
): string {
  if (type === 'metric') {
    const labels: Record<string, string> = {
      rps: 'Requests / sec',
      dau: 'Daily Active Users',
      mau: 'Monthly Active Users',
      allUsers: 'All Users',
      reqs: 'Total Requests',
      egress: 'Egress',
      fns: 'Functions Duration',
      storage: 'Storage',
      pgvol: 'Postgres Volume',
    };
    return labels[cfg?.metric ?? 'rps'] ?? 'Metric';
  }
  return WIDGET_TYPES[type].name;
}

export function widgetSubtitle(
  type: WidgetType,
  cfg: { window?: string; count?: number } | undefined,
): string | null {
  switch (type) {
    case 'metric':
      return `${cfg?.window ?? '24h'} window`;
    case 'pulse':
      return 'Requests over time';
    case 'health':
      return 'Status of services on this project';
    case 'deploys':
      return `Last ${cfg?.count ?? 5} deployments`;
    case 'logs':
      return `Last ${cfg?.count ?? 7} entries`;
    case 'repo':
      return 'Connected for deployments';
    default:
      return null;
  }
}
