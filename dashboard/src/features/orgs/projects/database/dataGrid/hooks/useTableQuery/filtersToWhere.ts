import { format } from 'node-pg-format';
import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isEmptyValue } from '@/lib/utils';

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
    if (['@>', '<@'].includes(op)) {
      return format('%I %s %L::jsonb', column, op, value);
    }
    if (['?|', '?&'].includes(op)) {
      const keys = value.split(',').map((k) => k.trim());
      return format('%I %s array[%L]', column, op, keys);
    }
    return format('%I %s %L', column, op, value);
  });

  return `WHERE ${whereClauses.join(' AND ')}`;
}
