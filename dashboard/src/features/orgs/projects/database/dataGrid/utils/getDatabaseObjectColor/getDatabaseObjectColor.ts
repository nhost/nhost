import type { DataBrowserSidebarFilterType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const colorByType: Record<DataBrowserSidebarFilterType, string> = {
  'ORDINARY TABLE': 'text-blue-500',
  VIEW: 'text-cyan-600 dark:text-cyan-400',
  'MATERIALIZED VIEW': 'text-purple-500',
  'FOREIGN TABLE': 'text-rose-500',
  FUNCTION: 'text-amber-600 dark:text-amber-400',
  ENUM: 'text-emerald-600 dark:text-emerald-400',
};

export default function getDatabaseObjectColor(
  objectType: DataBrowserSidebarFilterType,
): string {
  return colorByType[objectType];
}
