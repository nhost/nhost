import { type DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isEmptyValue } from '@/lib/utils';
import { format } from 'node-pg-format';

export function filtersToWhere(filters?: DataGridFilter[]): string {
  if (isEmptyValue(filters)) {
    return '';
  }

  const whereClauses = filters!.map((filter) => {
    const { column, op, value } = filter;
    if (['IN', 'NOT IN'].includes(op)) {
      const values = value.split(',');
      return format(`%I %s (%L)`, column, op, values);
    }
    if (['IS', 'IS NOT'].includes(op)) {
      return format('%I %s NULL', column, op);
    }
    return format('%I %s %L', column, op, value);
  });

  return `WHERE ${whereClauses.join(' AND ')}`;
}
