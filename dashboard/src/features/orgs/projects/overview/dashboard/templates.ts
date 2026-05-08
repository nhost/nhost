import type {
  DashboardLayout,
  DashboardTemplate,
} from '@/features/orgs/projects/overview/dashboard/types';

// 24-col grid for finer width-step granularity. rowHeight 40 + gutter 12.
// Metric tile at h:2 = 92px (matches main's MetricsCard min-h-[92px]).
export const GRID_COLS = 24;
export const GRID_ROW_HEIGHT = 40;
export const GRID_GUTTER = 12;

export const DEFAULT_LAYOUT: DashboardLayout = [
  // 3×3 metric grid on the left (cols 0–14, w:5 each)
  {
    i: 'm-dau',
    type: 'metric',
    cfg: { metric: 'dau' },
    x: 0,
    y: 0,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-mau',
    type: 'metric',
    cfg: { metric: 'mau' },
    x: 5,
    y: 0,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-allUsers',
    type: 'metric',
    cfg: { metric: 'allUsers' },
    x: 10,
    y: 0,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },

  {
    i: 'm-rps',
    type: 'metric',
    cfg: { metric: 'rps' },
    x: 0,
    y: 2,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-reqs',
    type: 'metric',
    cfg: { metric: 'reqs' },
    x: 5,
    y: 2,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-egress',
    type: 'metric',
    cfg: { metric: 'egress' },
    x: 10,
    y: 2,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },

  {
    i: 'm-fns',
    type: 'metric',
    cfg: { metric: 'fns' },
    x: 0,
    y: 4,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-storage',
    type: 'metric',
    cfg: { metric: 'storage' },
    x: 5,
    y: 4,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-pgvol',
    type: 'metric',
    cfg: { metric: 'pgvol' },
    x: 10,
    y: 4,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },

  // Right column (cols 16–23) — parallel to the metrics grid
  {
    i: 'health',
    type: 'health',
    cfg: {},
    x: 16,
    y: 0,
    w: 8,
    h: 3,
    minW: 6,
    minH: 3,
  },
  {
    i: 'info',
    type: 'info',
    cfg: {},
    x: 16,
    y: 3,
    w: 8,
    h: 4,
    minW: 6,
    minH: 4,
  },
  {
    i: 'repo',
    type: 'repo',
    cfg: {},
    x: 16,
    y: 7,
    w: 8,
    h: 4,
    minW: 6,
    minH: 4,
  },

  // Main column below metrics (cols 0–14 for deploys/logs, cols 0–15 for docs)
  {
    i: 'deploys',
    type: 'deploys',
    cfg: {},
    x: 0,
    y: 6,
    w: 15,
    h: 8,
    minW: 10,
    minH: 5,
  },
  {
    i: 'logs',
    type: 'logs',
    cfg: {},
    x: 0,
    y: 14,
    w: 15,
    h: 7,
    minW: 10,
    minH: 4,
  },
  {
    i: 'frameworks',
    type: 'frameworks-docs',
    cfg: {},
    x: 0,
    y: 21,
    w: 16,
    h: 7,
    minW: 10,
    minH: 5,
  },
  {
    i: 'features',
    type: 'features-docs',
    cfg: {},
    x: 0,
    y: 28,
    w: 16,
    h: 7,
    minW: 10,
    minH: 5,
  },
];

export const COMPACT_LAYOUT: DashboardLayout = [
  // Same 16 + 8 split as Default, but trimmed: three resource-usage metrics
  // (Egress, Storage, Postgres Volume) in one row, deploys + logs side-by-
  // side, no frameworks docs.
  {
    i: 'm-egress',
    type: 'metric',
    cfg: { metric: 'egress' },
    x: 0,
    y: 0,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-storage',
    type: 'metric',
    cfg: { metric: 'storage' },
    x: 5,
    y: 0,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },
  {
    i: 'm-pgvol',
    type: 'metric',
    cfg: { metric: 'pgvol' },
    x: 10,
    y: 0,
    w: 5,
    h: 2,
    minW: 4,
    minH: 2,
  },

  // Right column (parallel to metrics + ops row)
  {
    i: 'health',
    type: 'health',
    cfg: {},
    x: 16,
    y: 0,
    w: 8,
    h: 3,
    minW: 6,
    minH: 3,
  },
  {
    i: 'info',
    type: 'info',
    cfg: {},
    x: 16,
    y: 3,
    w: 8,
    h: 4,
    minW: 6,
    minH: 4,
  },
  {
    i: 'repo',
    type: 'repo',
    cfg: {},
    x: 16,
    y: 7,
    w: 8,
    h: 4,
    minW: 6,
    minH: 4,
  },

  // Main column: deploys + logs side-by-side (8+8 in main col), then features
  {
    i: 'deploys',
    type: 'deploys',
    cfg: {},
    x: 0,
    y: 2,
    w: 8,
    h: 7,
    minW: 8,
    minH: 5,
  },
  {
    i: 'logs',
    type: 'logs',
    cfg: {},
    x: 8,
    y: 2,
    w: 8,
    h: 7,
    minW: 8,
    minH: 4,
  },
  {
    i: 'features',
    type: 'features-docs',
    cfg: {},
    x: 0,
    y: 9,
    w: 16,
    h: 7,
    minW: 10,
    minH: 5,
  },
];

export const TEMPLATES: DashboardTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    desc: 'The full Nhost overview — nine metric cards, deploys, logs, project health, info, repo, and docs.',
    layout: DEFAULT_LAYOUT,
  },
  {
    id: 'compact',
    name: 'Compact',
    desc: 'Tighter view — three resource-usage metrics, deploys & logs side-by-side, no frameworks docs.',
    layout: COMPACT_LAYOUT,
  },
];

export function findMatchingTemplateId(
  current: DashboardLayout,
  templates: DashboardTemplate[] = TEMPLATES,
): string {
  const sig = (l: DashboardLayout) =>
    l
      .map((it) => `${it.i}:${it.x},${it.y},${it.w},${it.h}`)
      .sort()
      .join('|');
  return templates.find((t) => sig(t.layout) === sig(current))?.id ?? 'default';
}
