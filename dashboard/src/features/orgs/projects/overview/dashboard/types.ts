export type WidgetType =
  | 'metric'
  | 'pulse'
  | 'health'
  | 'deploys'
  | 'logs'
  | 'info'
  | 'repo'
  | 'docs';

export type MetricKind =
  | 'rps'
  | 'dau'
  | 'mau'
  | 'allUsers'
  | 'reqs'
  | 'egress'
  | 'fns'
  | 'storage'
  | 'pgvol';

export type MetricWindow = '5m' | '1h' | '24h' | '7d' | 'MTD';

export type WidgetConfig = {
  metric?: MetricKind;
  window?: MetricWindow;
  count?: number;
  variant?: 'frameworks' | 'features';
};

export type LayoutItem = {
  i: string;
  type: WidgetType;
  cfg: WidgetConfig;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

export type DashboardLayout = LayoutItem[];

export type WidgetCategory = 'Metrics' | 'Activity' | 'Services' | 'Resources';

export type WidgetMeta = {
  name: string;
  desc: string;
  icon: string;
  cat: WidgetCategory;
  default: { w: number; h: number; minW: number; minH: number };
};

export type DashboardTemplate = {
  id: string;
  name: string;
  desc: string;
  layout: DashboardLayout;
};
