import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isEmptyValue } from '@/lib/utils';

export const DATA_GRID_FILTER_STORAGE_KEY = 'nhost_data_grid_filter_storage';

class PersistenDataGrdiFilterStorage {
  private static getAllStoredData(): Record<string, DataGridFilter[]> {
    const storedData = localStorage.getItem(DATA_GRID_FILTER_STORAGE_KEY);
    if (isEmptyValue(storedData)) {
      return {};
    }
    const allStoredData = JSON.parse(storedData as string);

    return allStoredData;
  }

  static getDataGridFilters(tablePath: string): DataGridFilter[] {
    const allStoredData = PersistenDataGrdiFilterStorage.getAllStoredData();
    return allStoredData[tablePath] ?? [];
  }

  static saveDataGridFilters(tablePath: string, filters: DataGridFilter[]) {
    const allStoredData = PersistenDataGrdiFilterStorage.getAllStoredData();

    const updatedAllStoredData: Record<string, DataGridFilter[]> = {
      ...allStoredData,
      [tablePath]: filters,
    };

    localStorage.setItem(
      DATA_GRID_FILTER_STORAGE_KEY,
      JSON.stringify(updatedAllStoredData),
    );
  }
}

export default PersistenDataGrdiFilterStorage;
