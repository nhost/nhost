import type { ColumnOrderState, VisibilityState } from '@tanstack/react-table';
import type { RowDensity } from '@/features/orgs/projects/common/types/dataTableConfigurationTypes';
import { isEmptyValue } from '@/lib/utils';

export const COLUMN_CONFIGURATION_STORAGE_KEY =
  'nhost_column_configuration_storage';

const DATA_TABLE_CONFIGURATION_STORAGE_KEY =
  'nhost_data_table_configuration_storage';

type ColumnConfiguration = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
};

type DataTableViewConfiguration = {
  rowDensity: RowDensity;
};

// biome-ignore lint/complexity/noStaticOnlyClass: TODO: use functions instead
class PersistenDataTableConfigurationStorage {
  private static getAllStoredData(): Record<string, ColumnConfiguration> {
    const storedData = localStorage.getItem(COLUMN_CONFIGURATION_STORAGE_KEY);
    if (isEmptyValue(storedData)) {
      return {};
    }
    const allStoredData = JSON.parse(storedData as string);

    return allStoredData;
  }

  static getColumnVisibility(tablePath: string): VisibilityState {
    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();
    return allStoredData[tablePath]?.columnVisibility ?? {};
  }

  static saveColumnVisibility(
    tablePath: string,
    columnVisibility: VisibilityState,
  ) {
    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();

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

  static toggleColumnVisibility(tablePath: string, columnId: string) {
    const columnVisibility =
      PersistenDataTableConfigurationStorage.getColumnVisibility(tablePath);

    const isVisible = !!columnVisibility[columnId];

    PersistenDataTableConfigurationStorage.saveColumnVisibility(tablePath, {
      ...columnVisibility,
      [columnId]: !isVisible,
    });
  }

  static getColumnOrder(tablePath: string): ColumnOrderState {
    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();
    return allStoredData[tablePath]?.columnOrder ?? [];
  }

  static saveColumnOrder(tablePath: string, newColumnOrder: ColumnOrderState) {
    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();

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

  static getDataTableViewConfiguration(): DataTableViewConfiguration | null {
    const storedConfiguration = localStorage.getItem(
      DATA_TABLE_CONFIGURATION_STORAGE_KEY,
    );
    if (isEmptyValue(storedConfiguration)) {
      return null;
    }

    return JSON.parse(storedConfiguration as string);
  }

  static saveRowDensity(rowDensity: RowDensity) {
    const config =
      PersistenDataTableConfigurationStorage.getDataTableViewConfiguration() ??
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
}

export default PersistenDataTableConfigurationStorage;
