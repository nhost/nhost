import type { RowDensity } from '@/features/orgs/projects/common/types/dataTableConfigurationTypes';
import { isEmptyValue } from '@/lib/utils';

export const COLUMN_CONFIGURATION_STORAGE_KEY =
  'nhost_column_configuration_storage';

const DATA_TABLE_CONFIGURATION_STORAGE_KEY =
  'nhost_data_table_configuration_storage';

type ColumnConfiguration = {
  hiddenColumns: string[];
  columnOrder: string[];
};

type DataTableViewConfiguration = {
  rowDensity: RowDensity;
};

function getAllStoredData(): Record<string, ColumnConfiguration> {
  const storedData = localStorage.getItem(COLUMN_CONFIGURATION_STORAGE_KEY);
  if (isEmptyValue(storedData)) {
    return {};
  }
  const allStoredData = JSON.parse(storedData as string);

  return allStoredData;
}

export function getHiddenColumns(tablePath: string): string[] {
  const allStoredData = getAllStoredData();
  return allStoredData[tablePath]?.hiddenColumns ?? [];
}

export function saveHiddenColumns(tablePath: string, columnIds: string[]) {
  const allStoredData = getAllStoredData();

  const updatedAllStoredData: Record<string, ColumnConfiguration> = {
    ...allStoredData,
    [tablePath]: {
      ...allStoredData[tablePath],
      hiddenColumns: columnIds,
    },
  };

  localStorage.setItem(
    COLUMN_CONFIGURATION_STORAGE_KEY,
    JSON.stringify(updatedAllStoredData),
  );
}

export function toggleColumnVisibility(tablePath: string, columnId: string) {
  const allHiddenColumns = getHiddenColumns(tablePath);

  const newHiddenColumns = allHiddenColumns.includes(columnId)
    ? allHiddenColumns.filter((id) => columnId !== id)
    : allHiddenColumns.concat(columnId);

  saveHiddenColumns(tablePath, newHiddenColumns);
}

export function getColumnOrder(tablePath: string) {
  const allStoredData = getAllStoredData();
  return allStoredData[tablePath]?.columnOrder ?? [];
}

export function saveColumnOrder(tablePath: string, newColumnOrder: string[]) {
  const allStoredData = getAllStoredData();

  const updatedAllStoredData: Record<string, ColumnConfiguration> = {
    ...allStoredData,
    [tablePath]: {
      ...allStoredData[tablePath],
      columnOrder: newColumnOrder,
    },
  };

  localStorage.setItem(
    COLUMN_CONFIGURATION_STORAGE_KEY,
    JSON.stringify(updatedAllStoredData),
  );
}

export function getDataTableViewConfiguration(): DataTableViewConfiguration | null {
  const storedConfiguration = localStorage.getItem(
    DATA_TABLE_CONFIGURATION_STORAGE_KEY,
  );
  if (isEmptyValue(storedConfiguration)) {
    return null;
  }

  return JSON.parse(storedConfiguration as string);
}

export function saveRowDensity(rowDensity: RowDensity) {
  const config =
    getDataTableViewConfiguration() ??
    ({} as DataTableViewConfiguration);

  const updatedConfig: DataTableViewConfiguration = {
    ...config,
    rowDensity,
  };

  localStorage.setItem(
    DATA_TABLE_CONFIGURATION_STORAGE_KEY,
    JSON.stringify(updatedConfig),
  );
}
