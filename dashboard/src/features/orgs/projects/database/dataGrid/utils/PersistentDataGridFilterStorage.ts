import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isEmptyValue } from '@/lib/utils';

export const DATA_GRID_FILTER_STORAGE_KEY = 'nhost_data_grid_filter_storage';

function getAllStoredData(): Record<string, DataGridFilter[]> {
  const storedData = localStorage.getItem(DATA_GRID_FILTER_STORAGE_KEY);
  if (isEmptyValue(storedData)) {
    return {};
  }
  const allStoredData = JSON.parse(storedData as string);

  return allStoredData;
}

export function getDataGridFilters(tablePath: string): DataGridFilter[] {
  const allStoredData = getAllStoredData();
  return allStoredData[tablePath] ?? [];
}

export function saveDataGridFilters(
  tablePath: string,
  filters: DataGridFilter[],
) {
  const allStoredData = getAllStoredData();

  const updatedAllStoredData: Record<string, DataGridFilter[]> = {
    ...allStoredData,
    [tablePath]: filters,
  };

  localStorage.setItem(
    DATA_GRID_FILTER_STORAGE_KEY,
    JSON.stringify(updatedAllStoredData),
  );
}
