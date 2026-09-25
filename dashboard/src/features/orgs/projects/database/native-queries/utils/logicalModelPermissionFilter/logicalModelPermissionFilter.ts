import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

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

export function resolveLogicalModelFieldDescriptors(
  model: LogicalModelItem,
): LogicalModelFieldDescriptor[] {
  return model.fields.flatMap((field) =>
    'scalar' in field.type
      ? [
          {
            name: field.name,
            nullable: field.type.nullable ?? false,
            scalar: field.type.scalar,
          },
        ]
      : [],
  );
}

const SCALAR_ALIASES: Readonly<Record<string, string>> = {
  character: 'bpchar',
  'character varying': 'varchar',
};

export function normalizeLogicalModelScalar(
  scalar?: string,
): string | undefined {
  if (!scalar) {
    return undefined;
  }
  const normalized = scalar.toLocaleLowerCase();
  return SCALAR_ALIASES[normalized] ?? normalized;
}
