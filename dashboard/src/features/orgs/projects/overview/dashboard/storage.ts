import type { DashboardLayout } from '@/features/orgs/projects/overview/dashboard/types';

const layoutKey = (subdomain: string) => `nhost.dashboard.${subdomain}.layout`;
const firstTimeKey = (subdomain: string) =>
  `nhost.dashboard.${subdomain}.firstTimeDismissed`;

export function loadLayout(subdomain: string): DashboardLayout | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(layoutKey(subdomain));
    return raw ? (JSON.parse(raw) as DashboardLayout) : null;
  } catch {
    return null;
  }
}

export function saveLayout(subdomain: string, layout: DashboardLayout) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(layoutKey(subdomain), JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

export function clearLayout(subdomain: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(layoutKey(subdomain));
}

export function isFirstTimeDismissed(subdomain: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(firstTimeKey(subdomain)) === 'true';
}

export function dismissFirstTime(subdomain: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(firstTimeKey(subdomain), 'true');
}
