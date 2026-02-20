import { expect, test } from 'vitest';
import parseRuleGroup from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/parseRuleGroup';
import serializeRuleGroup from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/serializeRuleGroup';
import type {
  ConditionNode,
  ExistsNode,
  GroupNode,
} from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/types';

function condition(
  column: string,
  operator: string,
  value: unknown,
): ConditionNode {
  return {
    type: 'condition',
    id: crypto.randomUUID(),
    column,
    operator: operator as ConditionNode['operator'],
    value,
  };
}

function group(
  operator: GroupNode['operator'],
  children: GroupNode['children'],
): GroupNode {
  return {
    type: 'group',
    id: crypto.randomUUID(),
    operator,
    children,
  };
}

function exists(schema: string, table: string, where: GroupNode): ExistsNode {
  return {
    type: 'exists',
    id: crypto.randomUUID(),
    schema,
    table,
    where,
  };
}

test('should serialize an ExistsNode to _exists structure', () => {
  const result = serializeRuleGroup(
    exists(
      'public',
      'users',
      group('_and', [condition('id', '_eq', 'X-Hasura-User-Id')]),
    ),
  );
  expect(result).toEqual({
    _exists: {
      _table: { schema: 'public', name: 'users' },
      _where: { id: { _eq: 'X-Hasura-User-Id' } },
    },
  });
});

test('should serialize an ExistsNode nested inside a group', () => {
  const result = serializeRuleGroup(
    group('_and', [
      condition('title', '_eq', 'test'),
      exists(
        'public',
        'users',
        group('_and', [condition('id', '_eq', 'X-Hasura-User-Id')]),
      ),
    ]),
  );
  expect(result).toEqual({
    _and: [
      { title: { _eq: 'test' } },
      {
        _exists: {
          _table: { schema: 'public', name: 'users' },
          _where: { id: { _eq: 'X-Hasura-User-Id' } },
        },
      },
    ],
  });
});

test('should return an empty object for an empty group', () => {
  expect(serializeRuleGroup(group('_and', []))).toEqual({});
});

test('should unwrap single-child non-_not groups', () => {
  const result = serializeRuleGroup(
    group('_and', [condition('title', '_eq', 'test')]),
  );
  expect(result).toEqual({ title: { _eq: 'test' } });
});

test('should not unwrap single-child _not groups', () => {
  const result = serializeRuleGroup(
    group('_not', [condition('title', '_eq', 'test')]),
  );
  expect(result).toEqual({ _not: { title: { _eq: 'test' } } });
});

test('should break down dot-notation columns into nested objects', () => {
  const result = serializeRuleGroup(
    group('_and', [
      condition('author.id', '_eq', '2aeba074-df72-4bd5-b827-162620a3438a'),
    ]),
  );
  expect(result).toEqual({
    author: { id: { _eq: '2aeba074-df72-4bd5-b827-162620a3438a' } },
  });

  const deep = serializeRuleGroup(
    group('_and', [condition('author.books.title', '_eq', 'Sample Book')]),
  );
  expect(deep).toEqual({
    author: { books: { title: { _eq: 'Sample Book' } } },
  });
});

test('should produce _or array for multiple children', () => {
  const result = serializeRuleGroup(
    group('_or', [
      condition('title', '_eq', 'test'),
      condition('title', '_eq', 'test2'),
    ]),
  );
  expect(result).toEqual({
    _or: [{ title: { _eq: 'test' } }, { title: { _eq: 'test2' } }],
  });
});

test('should serialize nested groups', () => {
  const result = serializeRuleGroup(
    group('_or', [
      condition('title', '_eq', 'test'),
      group('_and', [
        condition('age', '_neq', '20'),
        condition('age', '_neq', '30'),
      ]),
    ]),
  );
  expect(result).toEqual({
    _or: [
      { title: { _eq: 'test' } },
      { _and: [{ age: { _neq: '20' } }, { age: { _neq: '30' } }] },
    ],
  });
});

test('should convert _is_null string value to boolean', () => {
  const result = serializeRuleGroup(
    group('_and', [condition('title', '_is_null', 'true')]),
  );
  expect(result).toEqual({ title: { _is_null: true } });

  const falseResult = serializeRuleGroup(
    group('_and', [condition('title', '_is_null', 'false')]),
  );
  expect(falseResult).toEqual({ title: { _is_null: false } });
});

test('should handle _not with multiple children by wrapping in _and', () => {
  const result = serializeRuleGroup(
    group('_not', [
      condition('title', '_eq', 'test'),
      condition('age', '_gt', 10),
    ]),
  );
  expect(result).toEqual({
    _not: {
      _and: [{ title: { _eq: 'test' } }, { age: { _gt: 10 } }],
    },
  });
});

test('should serialize a single condition node directly', () => {
  const result = serializeRuleGroup(condition('title', '_eq', 'test'));
  expect(result).toEqual({ title: { _eq: 'test' } });
});

test('should handle _not with a nested _or group', () => {
  const result = serializeRuleGroup(
    group('_not', [
      group('_or', [
        condition('title', '_eq', 'test'),
        condition('age', '_gt', 32),
      ]),
    ]),
  );
  expect(result).toEqual({
    _not: {
      _or: [{ title: { _eq: 'test' } }, { age: { _gt: 32 } }],
    },
  });
});

test('round-trip: serialize then parse should produce structurally equivalent tree', () => {
  const original = group('_or', [
    condition('title', '_eq', 'hello'),
    group('_and', [
      condition('name', '_eq', 'John'),
      condition('age', '_gte', 18),
    ]),
  ]);

  const serialized = serializeRuleGroup(original);
  const reparsed = parseRuleGroup(serialized);

  expect(reparsed.operator).toBe(original.operator);
  expect(reparsed.children).toHaveLength(original.children.length);

  expect(reparsed.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'hello',
  });

  const innerGroup = reparsed.children[1];
  if (innerGroup.type !== 'group') {
    throw new Error('expected group');
  }
  expect(innerGroup.operator).toBe('_and');
  expect(innerGroup.children).toHaveLength(2);
  expect(innerGroup.children[0]).toMatchObject({
    type: 'condition',
    column: 'name',
    operator: '_eq',
    value: 'John',
  });
  expect(innerGroup.children[1]).toMatchObject({
    type: 'condition',
    column: 'age',
    operator: '_gte',
    value: 18,
  });
});

test('round-trip: single-child groups unwrap and reparse correctly', () => {
  const original = group('_and', [condition('id', '_eq', 'test-id')]);

  const serialized = serializeRuleGroup(original);
  expect(serialized).toEqual({ id: { _eq: 'test-id' } });

  const reparsed = parseRuleGroup(serialized);
  expect(reparsed.operator).toBe('_and');
  expect(reparsed.children).toHaveLength(1);
  expect(reparsed.children[0]).toMatchObject({
    type: 'condition',
    column: 'id',
    operator: '_eq',
    value: 'test-id',
  });
});
