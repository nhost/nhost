import type { SortingRule } from 'react-table';
import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isNotEmptyValue } from '@/lib/utils';

export function createTableQueryKey(
  tablePath: string,
  offset: number,
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  sortBy: SortingRule<any>[],
  filters: DataGridFilter[],
) {
  const sortByString = isNotEmptyValue(sortBy?.[0])
    ? `${sortBy[0].id}.${sortBy[0].desc}`
    : 'default-order';

  const filterString = isNotEmptyValue(filters)
    ? filters
        .map((filter) => `${filter.column}-${filter.op}-${filter.value}`)
        .join('')
    : 'no-filter';

  return [tablePath, offset, sortByString, filterString];
}
