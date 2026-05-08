import type {
  DashboardLayout,
  LayoutItem,
} from '@/features/orgs/projects/overview/dashboard/types';

function isOccupied(items: DashboardLayout, x: number, y: number): boolean {
  return items.some(
    (it) => x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h,
  );
}

function isAreaFree(
  items: DashboardLayout,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      if (isOccupied(items, x + dx, y + dy)) {
        return false;
      }
    }
  }
  return true;
}

export function findFreeSlot(
  items: DashboardLayout,
  cols: number,
  w: number,
  h: number,
): { x: number; y: number } {
  let y = 0;
  while (y < 400) {
    for (let x = 0; x <= cols - w; x++) {
      if (isAreaFree(items, x, y, w, h)) {
        return { x, y };
      }
    }
    y += 1;
  }
  return { x: 0, y: 0 };
}

export function makeId(type: LayoutItem['type']): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
