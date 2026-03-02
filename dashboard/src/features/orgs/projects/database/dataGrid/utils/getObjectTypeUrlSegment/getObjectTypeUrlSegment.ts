import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function getObjectTypeUrlSegment(
  objectType: DatabaseObjectType,
): 'tables' | 'views' | 'functions' {
  if (objectType === 'FUNCTION') {
    return 'functions';
  }
  if (['VIEW', 'MATERIALIZED VIEW'].includes(objectType)) {
    return 'views';
  }
  return 'tables';
}
