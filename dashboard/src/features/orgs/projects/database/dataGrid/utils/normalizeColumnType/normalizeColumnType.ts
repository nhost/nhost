import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function normalizeColumnType(column: NormalizedQueryDataRow) {
  return {
    label: column.full_data_type,
    value: column.full_data_type,
    isUserDefined: column.data_type === 'USER-DEFINED',
  };
}

export default normalizeColumnType;
