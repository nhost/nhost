export type WidgetType =
  | 'metric'
  | 'deploys'
  | 'frameworks-docs'
  | 'features-docs'
  | 'health'
  | 'info'
  | 'repo'
  | 'logs';

export type MetricKind =
  | 'dau'
  | 'mau'
  | 'allUsers'
  | 'rps'
  | 'reqs'
  | 'egress'
  | 'fns'
  | 'storage'
  | 'pgvol';

export type WidgetConfig = {
  metric?: MetricKind;
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

export type DashboardTemplate = {
  id: string;
  name: string;
  desc: string;
  layout: DashboardLayout;
};
