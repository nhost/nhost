import { dequal } from 'dequal';
import { v4 as uuidv4 } from 'uuid';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  GroupNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import type {
  LogicalModelItem,
  LogicalModelType,
} from '@/utils/hasura-api/generated/schemas';

export const LOGICAL_MODEL_COMPARISON_OPERATORS = [
  '_eq',
  '_neq',
  '_gt',
  '_gte',
  '_lt',
  '_lte',
  '_in',
  '_nin',
  '_is_null',
  '_like',
  '_ilike',
] as const satisfies readonly HasuraOperator[];

export type LogicalModelComparisonOperator =
  (typeof LOGICAL_MODEL_COMPARISON_OPERATORS)[number];

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
  selectablePaths: string[];
  traversalPaths: string[];
  issues: LogicalModelFieldIssue[];
}

export type LogicalModelFilterErrorCode =
  | 'collision'
  | 'empty-boolean-child'
  | 'invalid-condition'
  | 'invalid-field'
  | 'invalid-json-value'
  | 'invalid-node'
  | 'malformed-boolean-group'
  | 'noncanonical-is-null'
  | 'unsafe-key'
  | 'unsafe-object'
  | 'unknown-operator';

export interface LogicalModelFilterError {
  code: LogicalModelFilterErrorCode;
  path: string;
  message: string;
}

export type LogicalModelFilterParseResult =
  | { success: true; node: GroupNode }
  | { success: false; errors: LogicalModelFilterError[] };

export type LogicalModelFilterSerializationResult =
  | { success: true; value: Record<string, unknown> }
  | { success: false; errors: LogicalModelFilterError[] };

export type LogicalModelFilterCompatibility =
  | {
      compatible: true;
      node: GroupNode;
      value: Record<string, unknown>;
    }
  | {
      compatible: false;
      errors: LogicalModelFilterError[];
    };

const COMPARISON_OPERATORS = new Set<string>(
  LOGICAL_MODEL_COMPARISON_OPERATORS,
);
const BOOLEAN_OPERATORS = new Set(['_and', '_or', '_not']);
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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
          nullable: field.type.nullable,
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
        nullable: field.type.nullable,
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
    selectablePaths: safeDescriptors
      .filter((descriptor) => descriptor.selectable)
      .map((descriptor) => descriptor.path),
    traversalPaths: safeDescriptors
      .filter((descriptor) => !descriptor.selectable)
      .map((descriptor) => descriptor.path),
    issues,
  };
}

function error(
  code: LogicalModelFilterErrorCode,
  path: string,
  message: string,
): LogicalModelFilterError {
  return { code, path, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJsonValue(
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): LogicalModelFilterError | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? undefined
      : error(
          'invalid-json-value',
          path,
          'Comparison values must be JSON values.',
        );
  }
  if (typeof value !== 'object') {
    return error(
      'invalid-json-value',
      path,
      'Comparison values must be JSON values.',
    );
  }
  if (ancestors.has(value)) {
    return error('unsafe-object', path, 'Cyclic objects are not supported.');
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const childError = validateJsonValue(
        item,
        `${path}[${index}]`,
        ancestors,
      );
      if (childError) {
        ancestors.delete(value);
        return childError;
      }
    }
    ancestors.delete(value);
    return undefined;
  }
  if (!isPlainObject(value)) {
    ancestors.delete(value);
    return error('unsafe-object', path, 'Only plain objects are supported.');
  }
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) {
      ancestors.delete(value);
      return error('unsafe-key', `${path}.${key}`, 'Unsafe object key.');
    }
    const childError = validateJsonValue(
      value[key],
      `${path}.${key}`,
      ancestors,
    );
    if (childError) {
      ancestors.delete(value);
      return childError;
    }
  }
  ancestors.delete(value);
  return undefined;
}

interface ParseContext {
  selectablePaths: ReadonlySet<string>;
  traversalPaths: ReadonlySet<string>;
}

type NodesResult =
  | { success: true; nodes: RuleNode[] }
  | { success: false; errors: LogicalModelFilterError[] };

type GroupResult =
  | { success: true; node: GroupNode }
  | { success: false; errors: LogicalModelFilterError[] };

function parseCondition(
  value: unknown,
  fieldPath: string,
  metadataPath: string,
): NodesResult {
  if (!isPlainObject(value)) {
    return {
      success: false,
      errors: [
        error(
          'invalid-condition',
          metadataPath,
          'A field condition must be an operator object.',
        ),
      ],
    };
  }
  const operatorKeys = Object.keys(value);
  if (operatorKeys.length === 0) {
    return {
      success: false,
      errors: [
        error(
          'invalid-condition',
          metadataPath,
          'A field condition must contain an operator.',
        ),
      ],
    };
  }

  const nodes: RuleNode[] = [];
  for (const operator of operatorKeys) {
    if (UNSAFE_KEYS.has(operator)) {
      return {
        success: false,
        errors: [
          error(
            'unsafe-key',
            `${metadataPath}.${operator}`,
            'Unsafe object key.',
          ),
        ],
      };
    }
    if (!COMPARISON_OPERATORS.has(operator)) {
      return {
        success: false,
        errors: [
          error(
            'unknown-operator',
            `${metadataPath}.${operator}`,
            `Unsupported comparison operator: ${operator}.`,
          ),
        ],
      };
    }
    const operatorValue = value[operator];
    if (operator === '_is_null' && typeof operatorValue !== 'boolean') {
      return {
        success: false,
        errors: [
          error(
            'noncanonical-is-null',
            `${metadataPath}.${operator}`,
            '_is_null must be a Boolean.',
          ),
        ],
      };
    }
    const valueError = validateJsonValue(
      operatorValue,
      `${metadataPath}.${operator}`,
      new WeakSet(),
    );
    if (valueError) {
      return { success: false, errors: [valueError] };
    }
    nodes.push({
      type: 'condition',
      id: uuidv4(),
      column: fieldPath,
      operator: operator as LogicalModelComparisonOperator,
      value: operatorValue,
    });
  }
  return { success: true, nodes };
}

function parseObjectEntries(
  value: Record<string, unknown>,
  context: ParseContext,
  fieldPrefix: string,
  metadataPath: string,
): NodesResult {
  const nodes: RuleNode[] = [];
  for (const key of Object.keys(value)) {
    const keyPath = `${metadataPath}.${key}`;
    if (UNSAFE_KEYS.has(key)) {
      return {
        success: false,
        errors: [error('unsafe-key', keyPath, 'Unsafe object key.')],
      };
    }

    if (key === '_and' || key === '_or') {
      const groupValue = value[key];
      if (!Array.isArray(groupValue)) {
        return {
          success: false,
          errors: [
            error(
              'malformed-boolean-group',
              keyPath,
              `${key} must contain an array of objects.`,
            ),
          ],
        };
      }
      const children: RuleNode[] = [];
      for (const [index, child] of groupValue.entries()) {
        const childPath = `${keyPath}[${index}]`;
        if (!isPlainObject(child)) {
          return {
            success: false,
            errors: [
              error(
                'malformed-boolean-group',
                childPath,
                `${key} children must be objects.`,
              ),
            ],
          };
        }
        if (Object.keys(child).length === 0) {
          return {
            success: false,
            errors: [
              error(
                'empty-boolean-child',
                childPath,
                'Empty objects inside Boolean groups are JSON-only.',
              ),
            ],
          };
        }
        const childResult = parseObjectAsGroup(
          child,
          context,
          fieldPrefix,
          childPath,
        );
        if (!childResult.success) {
          return childResult;
        }
        children.push(childResult.node);
      }
      nodes.push({ type: 'group', id: uuidv4(), operator: key, children });
      continue;
    }

    if (key === '_not') {
      const notValue = value[key];
      if (!isPlainObject(notValue)) {
        return {
          success: false,
          errors: [
            error(
              'malformed-boolean-group',
              keyPath,
              '_not must contain an object.',
            ),
          ],
        };
      }
      if (Object.keys(notValue).length === 0) {
        return {
          success: false,
          errors: [
            error(
              'empty-boolean-child',
              keyPath,
              'An empty _not object is JSON-only.',
            ),
          ],
        };
      }
      const childResult = parseObjectAsGroup(
        notValue,
        context,
        fieldPrefix,
        keyPath,
      );
      if (!childResult.success) {
        return childResult;
      }
      nodes.push({
        type: 'group',
        id: uuidv4(),
        operator: '_not',
        children:
          childResult.node.operator === '_implicit'
            ? childResult.node.children
            : [childResult.node],
      });
      continue;
    }

    if (key.startsWith('_') || BOOLEAN_OPERATORS.has(key)) {
      return {
        success: false,
        errors: [
          error(
            'unknown-operator',
            keyPath,
            `Unsupported logical operator: ${key}.`,
          ),
        ],
      };
    }

    const fieldPath = fieldPrefix ? `${fieldPrefix}.${key}` : key;
    if (context.selectablePaths.has(fieldPath)) {
      const conditionResult = parseCondition(value[key], fieldPath, keyPath);
      if (!conditionResult.success) {
        return conditionResult;
      }
      nodes.push(...conditionResult.nodes);
      continue;
    }
    if (context.traversalPaths.has(fieldPath)) {
      const nestedValue = value[key];
      if (
        !isPlainObject(nestedValue) ||
        Object.keys(nestedValue).length === 0
      ) {
        return {
          success: false,
          errors: [
            error(
              'invalid-field',
              keyPath,
              'A logical-model object field must contain nested conditions.',
            ),
          ],
        };
      }
      const nestedResult = parseObjectEntries(
        nestedValue,
        context,
        fieldPath,
        keyPath,
      );
      if (!nestedResult.success) {
        return nestedResult;
      }
      nodes.push(...nestedResult.nodes);
      continue;
    }
    return {
      success: false,
      errors: [
        error(
          'invalid-field',
          keyPath,
          `Field is not a selectable logical-model scalar: ${fieldPath}.`,
        ),
      ],
    };
  }
  return { success: true, nodes };
}

function parseObjectAsGroup(
  value: Record<string, unknown>,
  context: ParseContext,
  fieldPrefix: string,
  metadataPath: string,
): GroupResult {
  const result = parseObjectEntries(value, context, fieldPrefix, metadataPath);
  if (!result.success) {
    return result;
  }
  if (result.nodes.length === 1 && result.nodes[0].type === 'group') {
    return { success: true, node: result.nodes[0] };
  }
  return {
    success: true,
    node: {
      type: 'group',
      id: uuidv4(),
      operator: '_implicit',
      children: result.nodes,
    },
  };
}

export function parseLogicalModelFilter(
  filter: Record<string, unknown>,
  fields: LogicalModelFieldResolution,
): LogicalModelFilterParseResult {
  if (!isPlainObject(filter)) {
    return {
      success: false,
      errors: [
        error('unsafe-object', '$', 'The filter must be a plain object.'),
      ],
    };
  }
  return parseObjectAsGroup(
    filter,
    {
      selectablePaths: new Set(fields.selectablePaths),
      traversalPaths: new Set(fields.traversalPaths),
    },
    '',
    '$',
  );
}

function createNestedCondition(
  column: string,
  operator: HasuraOperator,
  value: unknown,
): Record<string, unknown> {
  const parts = column.split('.');
  let nested: Record<string, unknown> = { [operator]: value };
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    nested = { [parts[index]]: nested };
  }
  return nested;
}

type MergeResult =
  | { success: true; value: Record<string, unknown> }
  | { success: false };

function mergeWithoutCollision(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): MergeResult {
  const value: Record<string, unknown> = { ...left };
  for (const key of Object.keys(right)) {
    if (!Object.hasOwn(value, key)) {
      value[key] = right[key];
      continue;
    }
    const leftValue = value[key];
    const rightValue = right[key];
    if (isPlainObject(leftValue) && isPlainObject(rightValue)) {
      const nested = mergeWithoutCollision(leftValue, rightValue);
      if (!nested.success) {
        return nested;
      }
      value[key] = nested.value;
      continue;
    }
    return { success: false };
  }
  return { success: true, value };
}

function serializeRuleNode(
  node: RuleNode,
  selectablePaths: ReadonlySet<string>,
  path: string,
): LogicalModelFilterSerializationResult {
  if (node.type === 'condition') {
    if (!selectablePaths.has(node.column)) {
      return {
        success: false,
        errors: [
          error(
            'invalid-field',
            path,
            `Field is not a selectable logical-model scalar: ${node.column}.`,
          ),
        ],
      };
    }
    if (!COMPARISON_OPERATORS.has(node.operator)) {
      return {
        success: false,
        errors: [
          error(
            'unknown-operator',
            path,
            `Unsupported comparison operator: ${node.operator}.`,
          ),
        ],
      };
    }
    if (node.operator === '_is_null' && typeof node.value !== 'boolean') {
      return {
        success: false,
        errors: [
          error('noncanonical-is-null', path, '_is_null must be a Boolean.'),
        ],
      };
    }
    const valueError = validateJsonValue(node.value, path, new WeakSet());
    if (valueError) {
      return { success: false, errors: [valueError] };
    }
    return {
      success: true,
      value: createNestedCondition(node.column, node.operator, node.value),
    };
  }

  if (node.type !== 'group') {
    return {
      success: false,
      errors: [
        error(
          'invalid-node',
          path,
          'Logical-model filters support only conditions and Boolean groups.',
        ),
      ],
    };
  }

  const childValues: Record<string, unknown>[] = [];
  for (const [index, child] of node.children.entries()) {
    const result = serializeRuleNode(
      child,
      selectablePaths,
      `${path}.children[${index}]`,
    );
    if (!result.success) {
      return result;
    }
    childValues.push(result.value);
  }

  if (node.operator === '_and' || node.operator === '_or') {
    return { success: true, value: { [node.operator]: childValues } };
  }
  if (node.operator === '_not') {
    if (childValues.length === 0) {
      return {
        success: false,
        errors: [
          error(
            'malformed-boolean-group',
            path,
            '_not must contain at least one child.',
          ),
        ],
      };
    }
    return {
      success: true,
      value: {
        _not: childValues.length === 1 ? childValues[0] : { _and: childValues },
      },
    };
  }
  if (node.operator !== '_implicit') {
    return {
      success: false,
      errors: [
        error(
          'invalid-node',
          path,
          `Unsupported group operator: ${node.operator}.`,
        ),
      ],
    };
  }

  let merged: Record<string, unknown> = {};
  for (const childValue of childValues) {
    const result = mergeWithoutCollision(merged, childValue);
    if (!result.success) {
      return { success: true, value: { _and: childValues } };
    }
    merged = result.value;
  }
  return { success: true, value: merged };
}

export function serializeLogicalModelFilter(
  node: RuleNode,
  fields: LogicalModelFieldResolution,
): LogicalModelFilterSerializationResult {
  return serializeRuleNode(node, new Set(fields.selectablePaths), '$');
}

export function analyzeLogicalModelFilter(
  filter: Record<string, unknown>,
  fields: LogicalModelFieldResolution,
): LogicalModelFilterCompatibility {
  const parsed = parseLogicalModelFilter(filter, fields);
  if (!parsed.success) {
    return { compatible: false, errors: parsed.errors };
  }
  const serialized = serializeLogicalModelFilter(parsed.node, fields);
  if (!serialized.success) {
    return { compatible: false, errors: serialized.errors };
  }
  if (!dequal(filter, serialized.value)) {
    return {
      compatible: false,
      errors: [
        error(
          'collision',
          '$',
          'The visual form would change the filter structure.',
        ),
      ],
    };
  }
  return { compatible: true, node: parsed.node, value: serialized.value };
}
