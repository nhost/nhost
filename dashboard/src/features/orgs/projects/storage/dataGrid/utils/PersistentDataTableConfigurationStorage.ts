import type { ColumnOrderState, VisibilityState } from '@tanstack/react-table';
import type { RowDensity } from '@/features/orgs/projects/common/types/dataTableConfigurationTypes';
import { SELECTION_COLUMN_ID } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/constants';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

export const COLUMN_CONFIGURATION_STORAGE_KEY =
  'nhost_column_configuration_storage';

const DATA_TABLE_CONFIGURATION_STORAGE_KEY =
  'nhost_data_table_configuration_storage';

type ColumnConfiguration = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
};

type OldColumnConfiguration = {
  hiddenColumns: string[];
  columnOrder: string[];
};

function isOldFormat(
  config: ColumnConfiguration | OldColumnConfiguration,
): config is OldColumnConfiguration {
  return 'hiddenColumns' in config;
}

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

export function getColumnVisibility(tablePath: string): VisibilityState {
  const allStoredData = getAllStoredData();
  return allStoredData[tablePath]?.columnVisibility ?? {};
}

export function saveColumnVisibility(
  tablePath: string,
  columnVisibility: VisibilityState,
) {
  const allStoredData = getAllStoredData();

  const updatedAllStoredData: Record<string, ColumnConfiguration> = {
    ...allStoredData,
    [tablePath]: {
      ...allStoredData[tablePath],
      columnVisibility,
    },
  };

  localStorage.setItem(
    COLUMN_CONFIGURATION_STORAGE_KEY,
    JSON.stringify(updatedAllStoredData),
  );
}

export function toggleColumnVisibility(tablePath: string, columnId: string) {
  const columnVisibility = getColumnVisibility(tablePath);

  const currentVisibilityState = columnVisibility[columnId] ?? true;
  const newVisibilityState = !currentVisibilityState;

  saveColumnVisibility(tablePath, {
    ...columnVisibility,
    [columnId]: newVisibilityState,
  });
}

export function getColumnOrder(tablePath: string): ColumnOrderState {
  const allStoredData = getAllStoredData();
  return allStoredData[tablePath]?.columnOrder ?? [];
}

export function saveColumnOrder(
  tablePath: string,
  newColumnOrder: ColumnOrderState,
) {
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
    getDataTableViewConfiguration() ?? ({} as DataTableViewConfiguration);

  const updatedConfig: DataTableViewConfiguration = {
    ...config,
    rowDensity,
  };

  localStorage.setItem(
    DATA_TABLE_CONFIGURATION_STORAGE_KEY,
    JSON.stringify(updatedConfig),
  );
}
export function convertToV8IfNeeded() {
  const allStoredData = getAllStoredData();

  const needsConversion = Object.values(allStoredData).some((config) =>
    isOldFormat(config as ColumnConfiguration | OldColumnConfiguration),
  );

  if (!needsConversion) {
    return;
  }

  const convertedData = { ...allStoredData };

  for (const key of Object.keys(allStoredData)) {
    const entry = allStoredData[key] as unknown as
      | ColumnConfiguration
      | OldColumnConfiguration;

    if (!isOldFormat(entry)) {
      continue;
    }

    const tableConfiguration = entry;

    const columnVisibility = isNotEmptyValue(tableConfiguration.hiddenColumns)
      ? tableConfiguration.hiddenColumns.reduce<VisibilityState>(
          (vs, col) => ({
            ...vs,
            [col]: false,
          }),
          {},
        )
      : (convertedData[key].columnVisibility ?? {});

    const columnOrder = isNotEmptyValue(tableConfiguration.columnOrder)
      ? [SELECTION_COLUMN_ID, ...tableConfiguration.columnOrder]
      : (convertedData[key].columnOrder ?? []);

    convertedData[key] = { columnVisibility, columnOrder };
  }

  localStorage.setItem(
    COLUMN_CONFIGURATION_STORAGE_KEY,
    JSON.stringify(convertedData),
  );
}
