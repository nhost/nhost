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

  static getHiddenColumns(tablePath: string): string[] {
    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();
    return allStoredData[tablePath]?.hiddenColumns ?? [];
  }

  static saveHiddenColumns(tablePath: string, columnIds: string[]) {
    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();

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

  static toggleColumnVisibility(tablePath: string, columnId: string) {
    const allHiddenColumns =
      PersistenDataTableConfigurationStorage.getHiddenColumns(tablePath);

    const newHiddenColumns = allHiddenColumns.includes(columnId)
      ? allHiddenColumns.filter((id) => columnId !== id)
      : allHiddenColumns.concat(columnId);

    PersistenDataTableConfigurationStorage.saveHiddenColumns(
      tablePath,
      newHiddenColumns,
    );
  }

  static getColumnOrder(tablePath: string) {
    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();
    return allStoredData[tablePath]?.columnOrder ?? [];
  }

  static saveColumnOrder(tablePath: string, newColumnOrder: string[]) {
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
