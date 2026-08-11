import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function normalizeColumnType(column: NormalizedQueryDataRow): string {
  if (
    column.data_type === 'USER-DEFINED' ||
    column.full_data_type.indexOf('(') > -1
  ) {
    return column.full_data_type;
  }
  return column.udt_name;
}

export default normalizeColumnType;
