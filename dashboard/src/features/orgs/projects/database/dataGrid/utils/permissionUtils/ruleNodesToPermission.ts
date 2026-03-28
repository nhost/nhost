import type {
  GroupNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const targetVal = result[key];
    const sourceVal = source[key];

    if (
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal) &&
      typeof sourceVal === 'object' &&
      sourceVal !== null &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

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
        _where: unWrapRuleNodes(node.where),
      },
    };
  }

  if (node.type === 'relationship') {
    const childSerialized = serializeNode(node.child);
    const parts = node.relationship.split('.');
    return parts.reduceRight(
      (inner, part) => ({ [part]: inner }) as Record<string, unknown>,
      childSerialized,
    );
  }

  if (node.operator === '_implicit') {
    return ruleNodesToPermission(node.children);
  }

  const childObjects = node.children.map(serializeNode);

  if (node.operator === '_not') {
    if (childObjects.length === 1) {
      return { _not: childObjects[0] };
    }
    return {
      _not: childObjects.reduce(deepMerge, {} as Record<string, unknown>),
    };
  }

  return { [node.operator]: childObjects };
}

export default function ruleNodesToPermission(
  nodes: RuleNode[],
): Record<string, unknown> {
  if (nodes.length === 0) {
    return {};
  }

  if (nodes.length === 1) {
    return serializeNode(nodes[0]);
  }

  return nodes
    .map(serializeNode)
    .reduce(
      (permission, ruleNode) => deepMerge(permission, ruleNode),
      {} as Record<string, unknown>,
    );
}

export function unWrapRuleNodes(root: GroupNode): Record<string, unknown> {
  if (root.operator === '_implicit') {
    return ruleNodesToPermission(root.children);
  }

  return ruleNodesToPermission([root]);
}
