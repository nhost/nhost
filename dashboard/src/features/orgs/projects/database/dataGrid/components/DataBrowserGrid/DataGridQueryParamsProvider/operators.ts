const commonOperators = [
  { op: '=', label: 'equals' },
  { op: '<>', label: 'not equals' },
  { op: 'IS', label: 'is NULL' },
  { op: 'IS NOT', label: 'is not NULL' },
] as const;

const comparisonOperators = [
  { op: 'IN', label: 'in' },
  { op: 'NOT IN', label: 'not in' },
  { op: '>', label: 'greater than' },
  { op: '<', label: 'less than' },
  { op: '>=', label: 'greater than or equal' },
  { op: '<=', label: 'less than or equal' },
] as const;

const textOperators = [
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

const jsonbOperators = [
  { op: '@>', label: 'contains (jsonb)' },
  { op: '<@', label: 'contained in (jsonb)' },
  { op: '?', label: 'has key (jsonb)' },
  { op: '?|', label: 'has any keys (jsonb)' },
  { op: '?&', label: 'has all keys (jsonb)' },
] as const;

export const operators = [
  ...commonOperators,
  ...comparisonOperators,
  ...textOperators,
  ...jsonbOperators,
] as const;

export type DataGridFilterOperator = (typeof operators)[number]['op'];

export const validOperators: Set<string> = new Set(
  operators.map((operator) => operator.op),
);

export function getAvailableOperators(
  dataType?: string,
): readonly { op: DataGridFilterOperator; label: string }[] {
  if (dataType === 'jsonb') {
    return [...commonOperators, ...jsonbOperators];
  }

  return [...commonOperators, ...comparisonOperators, ...textOperators];
}
