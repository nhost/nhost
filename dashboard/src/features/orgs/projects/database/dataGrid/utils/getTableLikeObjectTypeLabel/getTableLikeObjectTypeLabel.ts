import type { TableLikeObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const tableLikeObjectTypeLabels: Record<TableLikeObjectType, string> = {
  'ORDINARY TABLE': 'table',
  VIEW: 'view',
  'MATERIALIZED VIEW': 'materialized view',
  'FOREIGN TABLE': 'foreign table',
};

export function getTableLikeObjectTypeLabel(
  objectType?: TableLikeObjectType,
): string {
  return tableLikeObjectTypeLabels[objectType ?? 'ORDINARY TABLE'];
}

export function getCapitalizedTableLikeObjectTypeLabel(
  objectType?: TableLikeObjectType,
): string {
  const label = getTableLikeObjectTypeLabel(objectType);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
