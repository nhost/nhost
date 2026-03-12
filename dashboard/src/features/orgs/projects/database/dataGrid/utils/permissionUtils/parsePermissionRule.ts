import { v4 as uuidv4 } from 'uuid';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  GroupNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';

// _is_null is intentionally excluded here — it requires special handling to
// normalize boolean values to strings for the UI (see the _is_null branch below).
const HASURA_OPERATORS: ReadonlySet<string> = new Set<HasuraOperator>([
  '_eq',
  '_neq',
  '_in',
  '_nin',
  '_gt',
  '_lt',
  '_gte',
  '_lte',
  '_like',
  '_nlike',
  '_ilike',
  '_nilike',
  '_similar',
  '_nsimilar',
  '_regex',
  '_iregex',
  '_nregex',
  '_niregex',
  '_ceq',
  '_cne',
  '_cgt',
  '_clt',
  '_cgte',
  '_clte',
  '_contains',
  '_contained_in',
  '_has_key',
  '_has_keys_any',
  '_has_keys_all',
]);

function parsePermissionRule(
  permissionRule: Record<string, unknown>,
  columnPrefix?: string,
): RuleNode[] {
  const keys = Object.keys(permissionRule);

  if (keys.length === 0) {
    return [];
  }

  if (keys.length > 1) {
    return keys.flatMap((key) =>
      parsePermissionRule({ [key]: permissionRule[key] }, columnPrefix),
    );
  }

  const [currentKey] = keys;
  const value = permissionRule[currentKey];

  if (currentKey === '_exists') {
    const existsValue = value as {
      _table: { schema: string; name: string };
      _where: Record<string, unknown>;
    };
    return [
      {
        type: 'exists',
        id: uuidv4(),
        schema: existsValue._table.schema,
        table: existsValue._table.name,
        where: wrapPermissionsInAGroup(existsValue._where),
      },
    ];
  }

  if (currentKey === '_not') {
    const childNodes = parsePermissionRule(
      value as Record<string, unknown>,
      columnPrefix,
    );

    return [
      {
        type: 'group',
        id: uuidv4(),
        operator: '_not',
        children: childNodes,
      },
    ];
  }

  if (currentKey === '_is_null') {
    const normalizedValue =
      value === true || value === 'true' ? 'true' : 'false';

    return [
      {
        type: 'condition',
        id: uuidv4(),
        column: columnPrefix as string,
        operator: '_is_null',
        value: normalizedValue,
      },
    ];
  }

  if (HASURA_OPERATORS.has(currentKey)) {
    return [
      {
        type: 'condition',
        id: uuidv4(),
        column: columnPrefix as string,
        operator: currentKey as HasuraOperator,
        value,
      },
    ];
  }

  if (currentKey === '_and' || currentKey === '_or') {
    const children = (value as Record<string, unknown>[]).flatMap((item) =>
      parsePermissionRule(item, columnPrefix),
    );

    return [
      {
        type: 'group',
        id: uuidv4(),
        operator: currentKey,
        children,
      },
    ];
  }

  if (typeof value !== 'object' || value === null) {
    console.error(
      `parsePermissionRule: unexpected primitive value for key "${currentKey}":`,
      value,
    );
    return [];
  }

  const valueObj = value as Record<string, unknown>;
  const valueKeys = Object.keys(valueObj);

  // If every key in the nested object is a Hasura comparison operator, then
  // currentKey is a column name — recurse so the operator branches above can
  // create ConditionNodes with this column.
  const isColumnLevel = valueKeys.every(
    (k) => HASURA_OPERATORS.has(k) || k === '_is_null',
  );

  if (isColumnLevel) {
    return parsePermissionRule(valueObj, currentKey);
  }

  // Otherwise currentKey is a relationship traversal. Parse the nested value
  // without a prefix (columns inside are relative to the related table) and
  // wrap in a RelationshipNode.
  const innerNodes = parsePermissionRule(valueObj);

  const child: GroupNode =
    innerNodes.length === 1 && innerNodes[0].type === 'group'
      ? innerNodes[0]
      : {
          type: 'group',
          id: uuidv4(),
          operator: '_implicit',
          children: innerNodes,
        };

  return [
    {
      type: 'relationship',
      id: uuidv4(),
      relationship: currentKey,
      child,
    },
  ];
}
export function wrapPermissionsInAGroup(
  permission: Record<string, unknown>,
): GroupNode {
  const nodes = parsePermissionRule(permission);

  if (nodes.length === 1 && nodes[0].type === 'group') {
    return nodes[0];
  }

  return {
    type: 'group',
    id: uuidv4(),
    operator: '_implicit',
    children: nodes,
  };
}
export default parsePermissionRule;
