import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface OperatorOption {
  value: HasuraOperator;
  label?: string;
  helperText: string;
}

export const commonOperators: OperatorOption[] = [
  { value: '_eq', helperText: 'equal' },
  { value: '_neq', helperText: 'not equal' },
  { value: '_in', helperText: 'in (array)' },
  { value: '_nin', helperText: 'not in (array)' },
  { value: '_gt', helperText: 'greater than' },
  { value: '_lt', helperText: 'lower than' },
  { value: '_gte', helperText: 'greater than or equal' },
  { value: '_lte', helperText: 'lower than or equal' },
  { value: '_ceq', helperText: 'equal to column' },
  { value: '_cne', helperText: 'not equal to column' },
  { value: '_cgt', helperText: 'greater than column' },
  { value: '_clt', helperText: 'lower than column' },
  { value: '_cgte', helperText: 'greater than or equal to column' },
  { value: '_clte', helperText: 'lower than or equal to column' },
  { value: '_is_null', helperText: 'null' },
];

export const textSpecificOperators: OperatorOption[] = [
  { value: '_like', helperText: 'like' },
  { value: '_nlike', helperText: 'not like' },
  { value: '_ilike', helperText: 'like (case-insensitive)' },
  { value: '_nilike', helperText: 'not like (case-insensitive)' },
  { value: '_similar', helperText: 'similar' },
  { value: '_nsimilar', helperText: 'not similar' },
  { value: '_regex', helperText: 'matches regex' },
  { value: '_nregex', helperText: `doesn't match regex` },
  { value: '_iregex', helperText: 'matches case-insensitive regex' },
  { value: '_niregex', helperText: `doesn't match case-insensitive regex` },
];

export const jsonbSpecificOperators: OperatorOption[] = [
  { value: '_contains', helperText: 'contains the specified value' },
  {
    value: '_contained_in',
    helperText: 'is contained in the specified value',
  },
  { value: '_has_key', helperText: 'has the specified key' },
  { value: '_has_keys_any', helperText: 'has any of the specified keys' },
  { value: '_has_keys_all', helperText: 'has all of the specified keys' },
];

export function getAvailableOperators(columnType?: string): OperatorOption[] {
  let operators = [...commonOperators];

  if (columnType === 'text') {
    operators = operators.concat(textSpecificOperators);
  } else if (columnType === 'jsonb') {
    operators = operators.concat(jsonbSpecificOperators);
  }

  return operators;
}
