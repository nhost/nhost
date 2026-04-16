import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { validOperators } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
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

export function getDataGridFilters(storageKey: string): DataGridFilter[] {
  const allStoredData = getAllStoredData();
  const filters = allStoredData[storageKey] ?? [];

  return filters.filter((filter) => validOperators.has(filter.op));
}

export function saveDataGridFilters(
  storageKey: string,
  filters: DataGridFilter[],
) {
  const allStoredData = getAllStoredData();

  const updatedAllStoredData: Record<string, DataGridFilter[]> = {
    ...allStoredData,
    [storageKey]: filters,
  };

  localStorage.setItem(
    DATA_GRID_FILTER_STORAGE_KEY,
    JSON.stringify(updatedAllStoredData),
  );
}
