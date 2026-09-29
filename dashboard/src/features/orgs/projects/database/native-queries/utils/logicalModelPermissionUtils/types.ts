import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface LogicalModelFieldDescriptor {
  name: string;
  nullable: boolean;
  scalar: string;
}

const COLUMN_COMPARISON_OPERATORS = new Set<HasuraOperator>([
  '_ceq',
  '_cne',
  '_cgt',
  '_clt',
  '_cgte',
  '_clte',
]);

export function isLogicalModelColumnComparisonOperator(
  operator: unknown,
): operator is HasuraOperator {
  return (
    typeof operator === 'string' &&
    COLUMN_COMPARISON_OPERATORS.has(operator as HasuraOperator)
  );
}
