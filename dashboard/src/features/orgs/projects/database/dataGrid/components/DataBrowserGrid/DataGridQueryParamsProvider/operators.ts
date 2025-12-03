export const operators = [
  { op: '=', label: 'equals' },
  { op: '<>', label: 'not equals' },
  { op: 'IN', label: 'in' },
  { op: 'NOT IN', label: 'not in' },
  { op: 'IS', label: 'is NULL' },
  { op: 'IS NOT', label: 'is not NULL' },
  { op: '>', label: 'greater than' },
  { op: '<', label: 'less than' },
  { op: '>=', label: 'greater than or equal' },
  { op: '<=', label: 'less than or equal' },
  { op: 'LIKE', label: 'like' },
  { op: 'NOT LIKE', label: 'not like' },
  { op: 'ILIKE', label: 'like (case-insensitive)' },
  { op: 'NOT ILIKE', label: 'not like (case-insensitive)' },
  { op: 'SIMILAR TO', label: 'similar' },
  { op: 'NOT SIMILAR TO', label: 'not similar' },
  { op: '~', label: 'regex' },
  { op: '~*', label: 'regex (case-insensitive)' },
  { op: '!~', label: 'not regex' },
  { op: '!~*', label: 'not regex (case-insensitive)' },
] as const;

export type DataGridFilterOperator = (typeof operators)[number]['op'];
