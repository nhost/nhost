import { v4 as uuidv4 } from 'uuid';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  GroupNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/types';

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
  '_is_null',
  '_contains',
  '_contained_in',
  '_has_key',
  '_has_keys_any',
  '_has_keys_all',
]);

function parseEntry(
  hasuraPermissions: Record<string, unknown>,
  columnPrefix?: string,
): RuleNode[] {
  const keys = Object.keys(hasuraPermissions);

  if (keys.length === 0) {
    return [];
  }
  // TODO: Understand why the permission supposed to have one key
  if (keys.length !== 1) {
    return [];
  }

  const [currentKey] = keys;
  const value = hasuraPermissions[currentKey];

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
        where: parseRuleGroup(existsValue._where),
      },
    ];
  }

  if (currentKey === '_not') {
    const childNodes = parseEntry(
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
      typeof value === 'boolean' ? String(value) : String(value === 'true');

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
  // TODO: Check if these two if returns the same value
  if (
    (currentKey === '_in' || currentKey === '_nin') &&
    typeof value === 'string'
  ) {
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
      parseEntry(item, columnPrefix),
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
    return [];
  }

  const nextPrefix = columnPrefix
    ? `${columnPrefix}.${currentKey}`
    : currentKey;

  return parseEntry(value as Record<string, unknown>, nextPrefix);
}

export default function parseRuleGroup(
  hasuraPermissions: Record<string, unknown>,
): GroupNode {
  const nodes = parseEntry(hasuraPermissions);

  if (nodes.length === 1 && nodes[0].type === 'group') {
    return nodes[0];
  }

  return {
    type: 'group',
    id: uuidv4(),
    operator: '_and',
    children: nodes,
  };
}
