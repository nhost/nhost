import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  LogicalModelItem,
  LogicalModelType,
} from '@/utils/hasura-api/generated/schemas';

export interface LogicalModelFieldDescriptor {
  kind: 'scalar' | 'object';
  name: string;
  path: string;
  nullable: boolean;
  selectable: boolean;
  scalar?: string;
  logicalModel?: string;
}

export type LogicalModelFieldIssueCode =
  | 'array'
  | 'cycle'
  | 'duplicate-field'
  | 'dotted-name'
  | 'unresolved-reference'
  | 'unsafe-name';

export interface LogicalModelFieldIssue {
  code: LogicalModelFieldIssueCode;
  path: string;
  reference?: string;
}

export interface LogicalModelFieldResolution {
  descriptors: LogicalModelFieldDescriptor[];
  issues: LogicalModelFieldIssue[];
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
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

function isUnsafeSegment(value: string): boolean {
  return value.length === 0 || value.startsWith('_') || UNSAFE_KEYS.has(value);
}

function getTypeKind(type: LogicalModelType): 'array' | 'object' | 'scalar' {
  if ('array' in type) {
    return 'array';
  }
  if ('logical_model' in type) {
    return 'object';
  }
  return 'scalar';
}

export function resolveLogicalModelFieldDescriptors(
  model: LogicalModelItem,
  models: readonly LogicalModelItem[],
): LogicalModelFieldResolution {
  const descriptors: LogicalModelFieldDescriptor[] = [];
  const issues: LogicalModelFieldIssue[] = [];
  const dottedPaths = new Set<string>();
  const modelsByName = new Map<string, LogicalModelItem[]>();

  for (const item of models) {
    const matches = modelsByName.get(item.name) ?? [];
    matches.push(item);
    modelsByName.set(item.name, matches);
  }

  function visit(
    current: LogicalModelItem,
    prefix: string,
    branch: ReadonlySet<string>,
  ): void {
    const fieldCounts = new Map<string, number>();
    for (const field of current.fields) {
      fieldCounts.set(field.name, (fieldCounts.get(field.name) ?? 0) + 1);
      if (field.name.includes('.')) {
        dottedPaths.add(prefix ? `${prefix}.${field.name}` : field.name);
      }
    }

    for (const field of current.fields) {
      const path = prefix ? `${prefix}.${field.name}` : field.name;
      if ((fieldCounts.get(field.name) ?? 0) > 1) {
        issues.push({ code: 'duplicate-field', path });
        continue;
      }
      if (field.name.includes('.')) {
        issues.push({ code: 'dotted-name', path });
        continue;
      }
      if (isUnsafeSegment(field.name)) {
        issues.push({ code: 'unsafe-name', path });
        continue;
      }

      const kind = getTypeKind(field.type);
      if (kind === 'array') {
        issues.push({ code: 'array', path });
        continue;
      }
      if (kind === 'scalar' && 'scalar' in field.type) {
        descriptors.push({
          kind: 'scalar',
          name: field.name,
          path,
          nullable: field.type.nullable ?? false,
          selectable: true,
          scalar: field.type.scalar,
        });
        continue;
      }
      if (!('logical_model' in field.type)) {
        continue;
      }

      const references = modelsByName.get(field.type.logical_model) ?? [];
      if (references.length !== 1) {
        issues.push({
          code: 'unresolved-reference',
          path,
          reference: field.type.logical_model,
        });
        continue;
      }
      if (branch.has(field.type.logical_model)) {
        issues.push({
          code: 'cycle',
          path,
          reference: field.type.logical_model,
        });
        continue;
      }
      descriptors.push({
        kind: 'object',
        name: field.name,
        path,
        nullable: field.type.nullable ?? false,
        selectable: false,
        logicalModel: field.type.logical_model,
      });
      visit(
        references[0],
        path,
        new Set([...branch, field.type.logical_model]),
      );
    }
  }

  visit(model, '', new Set([model.name]));

  const safeDescriptors = descriptors.filter((descriptor) => {
    if (!dottedPaths.has(descriptor.path)) {
      return true;
    }
    if (!issues.some((issue) => issue.path === descriptor.path)) {
      issues.push({ code: 'dotted-name', path: descriptor.path });
    }
    return false;
  });

  return {
    descriptors: safeDescriptors,
    issues,
  };
}

const SCALAR_ALIASES: Readonly<Record<string, string>> = {
  character: 'bpchar',
  'character varying': 'varchar',
  citext: 'text',
  json: 'jsonb',
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
