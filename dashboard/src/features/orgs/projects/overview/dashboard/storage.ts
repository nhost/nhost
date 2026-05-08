import type { DashboardLayout } from '@/features/orgs/projects/overview/dashboard/types';

const layoutKey = (projectId: string) => `nhost.dashboard.${projectId}.layout`;
const firstTimeKey = (projectId: string) =>
  `nhost.dashboard.${projectId}.firstTimeDismissed`;

export function loadLayout(projectId: string): DashboardLayout | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(layoutKey(projectId));
    return raw ? (JSON.parse(raw) as DashboardLayout) : null;
  } catch {
    return null;
  }
}

export function saveLayout(projectId: string, layout: DashboardLayout) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(layoutKey(projectId), JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

export function clearLayout(projectId: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(layoutKey(projectId));
}

export function isFirstTimeDismissed(projectId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(firstTimeKey(projectId)) === 'true';
}

export function dismissFirstTime(projectId: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(firstTimeKey(projectId), 'true');
}
