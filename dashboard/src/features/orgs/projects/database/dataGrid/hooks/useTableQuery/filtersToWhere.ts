import { type DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isEmptyValue } from '@/lib/utils';
import { format } from 'node-pg-format';

export function filtersToWhere(filters?: DataGridFilter[]): string {
  if (isEmptyValue(filters)) {
    return '';
  }

  const whereClauses = filters!.map((filter) => {
    const column = format(filter.column);

    if (['IN', 'NOT IN'].includes(filter.op)) {
      const values = JSON.parse(filter.value);
      return format(`%I ${filter.op} (%L)`, column, values);
    }
    if (['IS', 'IS NOT'].includes(filter.op)) {
      return format('%I %s NULL', column, filter.op);
    }
    return format('%I %s %L', column, filter.op, filter.value);
  });

  return `WHERE ${whereClauses.join(' AND ')}`;
}
