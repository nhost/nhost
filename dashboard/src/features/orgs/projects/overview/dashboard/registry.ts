import type {
  WidgetCategory,
  WidgetConfig,
  WidgetType,
} from '@/features/orgs/projects/overview/dashboard/types';

// Sizes in 24-col grid units. See templates.ts for the grid config.
export const WIDGET_TYPES: Record<
  WidgetType,
  { defaultSize: { w: number; h: number; minW: number; minH: number } }
> = {
  metric: { defaultSize: { w: 8, h: 2, minW: 4, minH: 2 } },
  deploys: { defaultSize: { w: 16, h: 7, minW: 10, minH: 5 } },
  'frameworks-docs': { defaultSize: { w: 16, h: 7, minW: 10, minH: 5 } },
  'features-docs': { defaultSize: { w: 16, h: 7, minW: 10, minH: 5 } },
  health: { defaultSize: { w: 8, h: 4, minW: 6, minH: 3 } },
  info: { defaultSize: { w: 8, h: 5, minW: 6, minH: 4 } },
  repo: { defaultSize: { w: 8, h: 5, minW: 6, minH: 4 } },
  logs: { defaultSize: { w: 16, h: 7, minW: 10, minH: 4 } },
};

export type CatalogEntry = {
  key: string;
  name: string;
  desc: string;
  icon: string;
  category: WidgetCategory;
  type: WidgetType;
  cfg: WidgetConfig;
  defaultSize: { w: number; h: number; minW: number; minH: number };
};

export const WIDGET_CATALOG: CatalogEntry[] = [
  {
    key: 'metric-dau',
    name: 'Daily Active Users',
    desc: 'Unique users active today',
    icon: 'Users',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'dau' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-mau',
    name: 'Monthly Active Users',
    desc: 'Unique users active this month',
    icon: 'Users',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'mau' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-allUsers',
    name: 'All Users',
    desc: 'Total registered users',
    icon: 'UsersRound',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'allUsers' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-rps',
    name: 'RPS',
    desc: 'Requests per second over the last 5 minutes',
    icon: 'Activity',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'rps' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-reqs',
    name: 'Total Requests',
    desc: 'Service requests this month',
    icon: 'ArrowRightLeft',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'reqs' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-egress',
    name: 'Egress',
    desc: 'Outgoing data transfer this month',
    icon: 'ArrowDownToLine',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'egress' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-fns',
    name: 'Functions Duration',
    desc: 'Functions execution this month',
    icon: 'Code',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'fns' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-storage',
    name: 'Storage',
    desc: 'Total stored file size',
    icon: 'Folder',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'storage' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'metric-pgvol',
    name: 'Postgres Volume',
    desc: 'Postgres database storage',
    icon: 'Database',
    category: 'Metrics',
    type: 'metric',
    cfg: { metric: 'pgvol' },
    defaultSize: { w: 8, h: 2, minW: 4, minH: 2 },
  },
  {
    key: 'deploys',
    name: 'Recent deployments',
    desc: 'Last commits and their status',
    icon: 'GitCommit',
    category: 'Activity',
    type: 'deploys',
    cfg: {},
    defaultSize: { w: 16, h: 7, minW: 10, minH: 5 },
  },
  {
    key: 'logs',
    name: 'Recent logs',
    desc: 'Live tail of service logs',
    icon: 'FileText',
    category: 'Activity',
    type: 'logs',
    cfg: {},
    defaultSize: { w: 16, h: 7, minW: 10, minH: 4 },
  },
  {
    key: 'health',
    name: 'Project health',
    desc: 'Live status of services',
    icon: 'HeartPulse',
    category: 'Services',
    type: 'health',
    cfg: {},
    defaultSize: { w: 8, h: 4, minW: 6, minH: 3 },
  },
  {
    key: 'info',
    name: 'Project info',
    desc: 'Region and subdomain',
    icon: 'Info',
    category: 'Resources',
    type: 'info',
    cfg: {},
    defaultSize: { w: 8, h: 5, minW: 6, minH: 4 },
  },
  {
    key: 'repo',
    name: 'Repository',
    desc: 'Connected GitHub repo',
    icon: 'Github',
    category: 'Resources',
    type: 'repo',
    cfg: {},
    defaultSize: { w: 8, h: 5, minW: 6, minH: 4 },
  },
  {
    key: 'frameworks-docs',
    name: 'Frameworks',
    desc: 'Quickstart guides for popular frameworks',
    icon: 'BookOpen',
    category: 'Resources',
    type: 'frameworks-docs',
    cfg: {},
    defaultSize: { w: 16, h: 7, minW: 10, minH: 5 },
  },
  {
    key: 'features-docs',
    name: 'Platform docs',
    desc: 'In-depth Nhost feature docs',
    icon: 'Library',
    category: 'Resources',
    type: 'features-docs',
    cfg: {},
    defaultSize: { w: 16, h: 7, minW: 10, minH: 5 },
  },
];
