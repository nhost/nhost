import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { postgresTypeGroups } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

function getColumnValue(column: NormalizedQueryDataRow) {
  if (
    column.data_type === 'USER-DEFINED' ||
    column.full_data_type.indexOf('(') > -1
  ) {
    return column.full_data_type;
  }
  return column.udt_name;
}

function normalizeColumnType(column: NormalizedQueryDataRow) {
  const label =
    postgresTypeGroups.find((pt) => pt.value === column.full_data_type)
      ?.label || column.full_data_type;

  return {
    label,
    value: getColumnValue(column),
    custom:
      column.data_type === 'USER-DEFINED' ||
      column.full_data_type !== column.udt_name,
  };
}

export default normalizeColumnType;
