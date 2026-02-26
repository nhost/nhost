import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function getObjectTypeUrlSegment(
  objectType: DatabaseObjectType,
): 'tables' | 'views' {
  if (['VIEW', 'MATERIALIZED VIEW'].includes(objectType)) {
    return 'views';
  }
  return 'tables';
}
