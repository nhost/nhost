import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const colorByType: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'text-blue-500',
  VIEW: 'text-cyan-600 dark:text-cyan-400',
  'MATERIALIZED VIEW': 'text-purple-500',
  'FOREIGN TABLE': 'text-rose-500',
  FUNCTION: 'text-amber-600 dark:text-amber-400',
};

export default function getDatabaseObjectColor(
  objectType: DatabaseObjectType,
  isEnum: boolean,
): string {
  if (isEnum) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  return colorByType[objectType];
}
