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

type DataTableViewConfiguration = {
  rowDensity: RowDensity;
};

type OldColumnConfiguration = {
  hiddenColumns: string[];
  columnOrder: string[];
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

  static convertToV8IfNeeded() {
    const isConfigNotConvertedToV8 =
      localStorage.getItem(CONFIG_HAS_BEEN_CONVERTED_TO_V8_KEY) !== 'true';

    const allStoredData =
      PersistenDataTableConfigurationStorage.getAllStoredData();
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
}
export default PersistenDataTableConfigurationStorage;
