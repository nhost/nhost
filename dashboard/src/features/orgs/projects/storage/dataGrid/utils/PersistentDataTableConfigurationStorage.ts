import type { ColumnOrderState, VisibilityState } from '@tanstack/react-table';
import type { RowDensity } from '@/features/orgs/projects/common/types/dataTableConfigurationTypes';
import { SELECTION_COLUMN_ID } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

export const COLUMN_CONFIGURATION_STORAGE_KEY =
  'nhost_column_configuration_storage';

const DATA_TABLE_CONFIGURATION_STORAGE_KEY =
  'nhost_data_table_configuration_storage';

const CONFIG_HAS_BEEN_CONVERTED_TO_V8_KEY = 'nhost_has_been_converted_to_v8';

type ColumnConfiguration = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
};

type OldColumnConfiguration = {
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
  const isConfigNotConvertedToV8 =
    localStorage.getItem(CONFIG_HAS_BEEN_CONVERTED_TO_V8_KEY) !== 'true';

  const allStoredData = getAllStoredData();
  if (isConfigNotConvertedToV8 && isNotEmptyValue(allStoredData)) {
    const convertedData = {
      ...allStoredData,
    };

    Object.keys(allStoredData).forEach((key) => {
      const tableConfiguration = allStoredData[
        key
      ] as unknown as OldColumnConfiguration;

      const { hiddenColumns = [] } = tableConfiguration;
      if (isNotEmptyValue(hiddenColumns)) {
        const columnVisibility = hiddenColumns.reduce<VisibilityState>(
          (vs, col) => ({
            ...vs,
            [col]: false,
          }),
          {},
        );

        const columnOrder = isNotEmptyValue(tableConfiguration.columnOrder)
          ? [SELECTION_COLUMN_ID, ...(tableConfiguration.columnOrder ?? [])]
          : [];

        const v8TableConfig: ColumnConfiguration = {
          columnVisibility,
          columnOrder,
        };
        convertedData[key] = v8TableConfig;
      }
    });

    localStorage.setItem(
      COLUMN_CONFIGURATION_STORAGE_KEY,
      JSON.stringify(convertedData),
    );

    localStorage.setItem(CONFIG_HAS_BEEN_CONVERTED_TO_V8_KEY, 'true');
  }
}
