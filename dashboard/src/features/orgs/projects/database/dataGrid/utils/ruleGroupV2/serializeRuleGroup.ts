import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/types';

function createNestedObject(
  columnParts: string[],
  operator: string,
  value: unknown,
): Record<string, unknown> {
  if (columnParts.length === 1) {
    if (operator === '_is_null') {
      return {
        [columnParts[0]]: {
          [operator]: value === 'true',
        },
      };
    }

    return {
      [columnParts[0]]: {
        [operator]: value,
      },
    };
  }

  return {
    [columnParts[0]]: createNestedObject(columnParts.slice(1), operator, value),
  };
}

function serializeNode(node: RuleNode): Record<string, unknown> {
  if (node.type === 'condition') {
    const parts = node.column.split('.');
    return createNestedObject(parts, node.operator, node.value);
  }

  if (node.type === 'exists') {
    return {
      _exists: {
        _table: { schema: node.schema, name: node.table },
        _where: serializeRuleGroup(node.where),
      },
    };
  }

  const childObjects = node.children.map(serializeNode);

  if (node.operator === '_not') {
    if (childObjects.length === 1) {
      return { _not: childObjects[0] };
    }

    return { _not: { _and: childObjects } };
  }

  return { [node.operator]: childObjects };
}

export default function serializeRuleGroup(
  node: RuleNode,
): Record<string, unknown> {
  if (node.type === 'condition') {
    const parts = node.column.split('.');
    return createNestedObject(parts, node.operator, node.value);
  }

  if (node.type === 'exists') {
    return serializeNode(node);
  }

  if (node.operator !== '_not') {
    if (node.children.length === 0) {
      return {};
    }

    if (node.children.length === 1) {
      return serializeNode(node.children[0]);
    }
  }

  return serializeNode(node);
}
