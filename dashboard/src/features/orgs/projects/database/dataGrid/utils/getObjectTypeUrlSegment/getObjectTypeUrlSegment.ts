import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function getObjectTypeUrlSegment(
  objectType: DatabaseObjectType,
): 'tables' | 'functions' {
  if (objectType === 'FUNCTION') {
    return 'functions';
  }
  return 'tables';
}
