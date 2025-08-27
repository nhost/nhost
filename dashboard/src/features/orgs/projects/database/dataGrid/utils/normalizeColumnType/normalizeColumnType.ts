import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { postgresTypeGroups } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

function normalizeColumnType(column: NormalizedQueryDataRow) {
  const label =
    postgresTypeGroups.find((pt) => pt.value === column.full_data_type)
      ?.label || column.full_data_type;
  return {
    label,
    value: column.full_data_type,
    custom:
      column.data_type === 'USER-DEFINED' ||
      column.full_data_type !== column.udt_name,
  };
}

export default normalizeColumnType;
