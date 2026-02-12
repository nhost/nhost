import { expect, test } from 'vitest';
import parseRuleGroup from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/parseRuleGroup';
import serializeRuleGroup from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/serializeRuleGroup';

test('should return an empty group when there are no permissions or the object is invalid', () => {
  const empty = parseRuleGroup({});
  expect(empty.type).toBe('group');
  expect(empty.operator).toBe('_and');
  expect(empty.children).toHaveLength(0);

  const invalid = parseRuleGroup({ invalid: 'object' });
  expect(invalid.type).toBe('group');
  expect(invalid.operator).toBe('_and');
  expect(invalid.children).toHaveLength(0);

  const multiKey = parseRuleGroup({
    key1: { _eq: 'test1' },
    key2: { _eq: 'test2' },
  });
  expect(multiKey.type).toBe('group');
  expect(multiKey.operator).toBe('_and');
  expect(multiKey.children).toHaveLength(0);
});

test('should convert value to stringified boolean if operator is _is_null', () => {
  const result = parseRuleGroup({
    _or: [
      { title: { _eq: 'test' } },
      { title: { _is_null: true } },
      { title: { _is_null: 'true' } },
      { title: { _is_null: 'false' } },
    ],
  });

  expect(result.type).toBe('group');
  expect(result.operator).toBe('_or');
  expect(result.children).toHaveLength(4);

  const [c0, c1, c2, c3] = result.children;
  expect(c0).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
  expect(c1).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_is_null',
    value: 'true',
  });
  expect(c2).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_is_null',
    value: 'true',
  });
  expect(c3).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_is_null',
    value: 'false',
  });
});

test('should convert a simple Hasura permission object to a condition wrapped in an _and group', () => {
  const result = parseRuleGroup({ title: { _eq: 'test' } });
  expect(result.type).toBe('group');
  expect(result.operator).toBe('_and');
  expect(result.children).toHaveLength(1);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
});

test('should handle _is_null with stringified false', () => {
  const result = parseRuleGroup({ title: { _is_null: 'false' } });
  expect(result.children).toHaveLength(1);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_is_null',
    value: 'false',
  });
});

test('should handle deep relationship traversal', () => {
  const result = parseRuleGroup({
    books: { author: { id: { _eq: 'X-Hasura-User-Id' } } },
  });
  expect(result.children).toHaveLength(1);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'books.author.id',
    operator: '_eq',
    value: 'X-Hasura-User-Id',
  });
});

test('should convert a permission containing a relationship to a condition with dot notation', () => {
  const result = parseRuleGroup({
    author: { name: { _eq: 'John Doe' } },
  });
  expect(result.children).toHaveLength(1);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'author.name',
    operator: '_eq',
    value: 'John Doe',
  });
});

test('should convert _or on the top level to a group node', () => {
  const result = parseRuleGroup({
    _or: [{ title: { _eq: 'test' } }, { title: { _eq: 'test2' } }],
  });
  expect(result.type).toBe('group');
  expect(result.operator).toBe('_or');
  expect(result.children).toHaveLength(2);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
  expect(result.children[1]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test2',
  });
});

test('should convert _and on the top level to a group node', () => {
  const result = parseRuleGroup({
    _and: [{ title: { _eq: 'test' } }, { title: { _eq: 'test2' } }],
  });
  expect(result.type).toBe('group');
  expect(result.operator).toBe('_and');
  expect(result.children).toHaveLength(2);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
  expect(result.children[1]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test2',
  });
});

test('should preserve nesting when a relationship contains a nested group', () => {
  const result = parseRuleGroup({
    author: {
      _and: [{ name: { _eq: 'John Doe' } }, { age: { _gte: '32' } }],
    },
  });
  expect(result.type).toBe('group');
  expect(result.operator).toBe('_and');
  expect(result.children).toHaveLength(2);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'author.name',
    operator: '_eq',
    value: 'John Doe',
  });
  expect(result.children[1]).toMatchObject({
    type: 'condition',
    column: 'author.age',
    operator: '_gte',
    value: '32',
  });
});

test('should convert a complex permission preserving nesting', () => {
  const result = parseRuleGroup({
    _or: [
      {
        author: {
          _and: [
            { name: { _eq: 'John Doe' } },
            { age: { _gte: '32' } },
            {
              _or: [{ name: { _eq: 'Mary Jane' } }, { age: { _lte: '48' } }],
            },
          ],
        },
      },
      { title: { _eq: 'test' } },
    ],
  });

  expect(result.type).toBe('group');
  expect(result.operator).toBe('_or');
  expect(result.children).toHaveLength(2);

  const andGroup = result.children[0];
  expect(andGroup).toMatchObject({ type: 'group', operator: '_and' });
  if (andGroup.type !== 'group') {
    throw new Error('expected group');
  }
  expect(andGroup.children).toHaveLength(3);
  expect(andGroup.children[0]).toMatchObject({
    type: 'condition',
    column: 'author.name',
    operator: '_eq',
    value: 'John Doe',
  });
  expect(andGroup.children[1]).toMatchObject({
    type: 'condition',
    column: 'author.age',
    operator: '_gte',
    value: '32',
  });

  const orSubGroup = andGroup.children[2];
  expect(orSubGroup).toMatchObject({ type: 'group', operator: '_or' });
  if (orSubGroup.type !== 'group') {
    throw new Error('expected group');
  }
  expect(orSubGroup.children).toHaveLength(2);
  expect(orSubGroup.children[0]).toMatchObject({
    type: 'condition',
    column: 'author.name',
    operator: '_eq',
    value: 'Mary Jane',
  });
  expect(orSubGroup.children[1]).toMatchObject({
    type: 'condition',
    column: 'author.age',
    operator: '_lte',
    value: '48',
  });

  expect(result.children[1]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
});

test('should convert JSONB operators to condition nodes', () => {
  const containsResult = parseRuleGroup({
    metadata: { _contains: { foo: 'bar' } },
  });
  expect(containsResult.children).toHaveLength(1);
  expect(containsResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'metadata',
    operator: '_contains',
    value: { foo: 'bar' },
  });

  const hasKeyResult = parseRuleGroup({
    metadata: { _has_key: 'foo' },
  });
  expect(hasKeyResult.children).toHaveLength(1);
  expect(hasKeyResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'metadata',
    operator: '_has_key',
    value: 'foo',
  });
});

test('should handle _not with a single condition', () => {
  const result = parseRuleGroup({ _not: { title: { _eq: 'test' } } });
  expect(result.type).toBe('group');
  expect(result.operator).toBe('_not');
  expect(result.children).toHaveLength(1);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
});

test('should handle _not with JSONB operators', () => {
  const containsResult = parseRuleGroup({
    _not: { metadata: { _contains: { foo: 'bar' } } },
  });
  expect(containsResult.operator).toBe('_not');
  expect(containsResult.children).toHaveLength(1);
  expect(containsResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'metadata',
    operator: '_contains',
    value: { foo: 'bar' },
  });

  const hasKeyResult = parseRuleGroup({
    _not: { json: { _has_key: 'hello' } },
  });
  expect(hasKeyResult.operator).toBe('_not');
  expect(hasKeyResult.children).toHaveLength(1);
  expect(hasKeyResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'json',
    operator: '_has_key',
    value: 'hello',
  });
});

test('should handle _not wrapping an _or group', () => {
  const result = parseRuleGroup({
    _not: {
      _or: [{ title: { _eq: 'test' } }, { age: { _gt: 32 } }],
    },
  });
  expect(result.type).toBe('group');
  expect(result.operator).toBe('_not');
  expect(result.children).toHaveLength(1);

  const orGroup = result.children[0];
  expect(orGroup).toMatchObject({ type: 'group', operator: '_or' });
  if (orGroup.type !== 'group') {
    throw new Error('expected group');
  }
  expect(orGroup.children).toHaveLength(2);
  expect(orGroup.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
  expect(orGroup.children[1]).toMatchObject({
    type: 'condition',
    column: 'age',
    operator: '_gt',
    value: 32,
  });
});

test('should handle _not wrapping an _or with nested sub-groups', () => {
  const result = parseRuleGroup({
    _not: {
      _or: [
        { title: { _eq: 'test' } },
        { age: { _gt: 32 } },
        { _or: [{ title: { _eq: 'sample' } }, { age: { _lt: 24 } }] },
      ],
    },
  });
  expect(result.operator).toBe('_not');
  expect(result.children).toHaveLength(1);

  const orGroup = result.children[0];
  if (orGroup.type !== 'group') {
    throw new Error('expected group');
  }
  expect(orGroup.operator).toBe('_or');
  expect(orGroup.children).toHaveLength(3);
  expect(orGroup.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });
  expect(orGroup.children[1]).toMatchObject({
    type: 'condition',
    column: 'age',
    operator: '_gt',
    value: 32,
  });

  const nestedOr = orGroup.children[2];
  if (nestedOr.type !== 'group') {
    throw new Error('expected group');
  }
  expect(nestedOr.operator).toBe('_or');
  expect(nestedOr.children).toHaveLength(2);
  expect(nestedOr.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'sample',
  });
  expect(nestedOr.children[1]).toMatchObject({
    type: 'condition',
    column: 'age',
    operator: '_lt',
    value: 24,
  });
});

test('should handle _not with _is_null', () => {
  const trueResult = parseRuleGroup({
    _not: { title: { _is_null: true } },
  });
  expect(trueResult.operator).toBe('_not');
  expect(trueResult.children).toHaveLength(1);
  expect(trueResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_is_null',
    value: 'true',
  });

  const falseResult = parseRuleGroup({
    _not: { title: { _is_null: 'false' } },
  });
  expect(falseResult.operator).toBe('_not');
  expect(falseResult.children).toHaveLength(1);
  expect(falseResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_is_null',
    value: 'false',
  });
});

test('should parse _exists objects', () => {
  const result = parseRuleGroup({
    _or: [
      { title: { _eq: 'test' } },
      {
        _exists: {
          _table: { name: 'users', schema: 'public' },
          _where: { id: { _eq: 'X-Hasura-User-Id' } },
        },
      },
      {
        _and: [
          { name: { _eq: 'John Doe' } },
          { age: { _gte: '32' } },
          {
            _exists: {
              _table: { name: 'users', schema: 'public' },
              _where: { id: { _eq: 'X-Hasura-User-Id' } },
            },
          },
        ],
      },
    ],
  });

  expect(result.operator).toBe('_or');
  expect(result.children).toHaveLength(3);

  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'title',
    operator: '_eq',
    value: 'test',
  });

  expect(result.children[1]).toMatchObject({
    type: 'exists',
    schema: 'public',
    table: 'users',
  });
  if (result.children[1].type !== 'exists') {
    throw new Error('expected exists node');
  }
  expect(result.children[1].where).toMatchObject({
    type: 'group',
    operator: '_and',
  });
  expect(result.children[1].where.children[0]).toMatchObject({
    type: 'condition',
    column: 'id',
    operator: '_eq',
    value: 'X-Hasura-User-Id',
  });

  const andGroup = result.children[2];
  if (andGroup.type !== 'group') {
    throw new Error('expected group');
  }
  expect(andGroup.operator).toBe('_and');
  expect(andGroup.children).toHaveLength(3);
  expect(andGroup.children[0]).toMatchObject({
    type: 'condition',
    column: 'name',
    operator: '_eq',
    value: 'John Doe',
  });
  expect(andGroup.children[1]).toMatchObject({
    type: 'condition',
    column: 'age',
    operator: '_gte',
    value: '32',
  });
  expect(andGroup.children[2]).toMatchObject({
    type: 'exists',
    schema: 'public',
    table: 'users',
  });
});

test('should parse _exists nested inside a relationship path', () => {
  const result = parseRuleGroup({
    books: {
      author: {
        _exists: {
          _table: { name: 'users', schema: 'public' },
          _where: { id: { _eq: 'X-Hasura-User-Id' } },
        },
      },
    },
  });
  expect(result.type).toBe('group');
  expect(result.operator).toBe('_and');
  expect(result.children).toHaveLength(1);
  expect(result.children[0]).toMatchObject({
    type: 'exists',
    schema: 'public',
    table: 'users',
  });
});

test('should assign unique ids to all nodes', () => {
  const result = parseRuleGroup({
    _or: [{ title: { _eq: 'test' } }, { age: { _gt: 10 } }],
  });

  expect(result.id).toBeDefined();
  expect(result.children[0].id).toBeDefined();
  expect(result.children[1].id).toBeDefined();
  expect(result.id).not.toBe(result.children[0].id);
  expect(result.children[0].id).not.toBe(result.children[1].id);
});

test('should handle _in and _nin with string values', () => {
  const inResult = parseRuleGroup({ role: { _in: 'X-Hasura-Allowed-Roles' } });
  expect(inResult.children).toHaveLength(1);
  expect(inResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'role',
    operator: '_in',
    value: 'X-Hasura-Allowed-Roles',
  });

  const ninResult = parseRuleGroup({
    role: { _nin: 'X-Hasura-Allowed-Roles' },
  });
  expect(ninResult.children).toHaveLength(1);
  expect(ninResult.children[0]).toMatchObject({
    type: 'condition',
    column: 'role',
    operator: '_nin',
    value: 'X-Hasura-Allowed-Roles',
  });
});

test('should handle _in and _nin with array values', () => {
  const result = parseRuleGroup({ status: { _in: ['active', 'pending'] } });
  expect(result.children).toHaveLength(1);
  expect(result.children[0]).toMatchObject({
    type: 'condition',
    column: 'status',
    operator: '_in',
    value: ['active', 'pending'],
  });
});

test('round-trip: _exists parses and serializes back correctly', () => {
  const input = {
    _exists: {
      _table: { schema: 'public', name: 'users' },
      _where: { id: { _eq: 'X-Hasura-User-Id' } },
    },
  };

  const parsed = parseRuleGroup(input);
  const serialized = serializeRuleGroup(parsed);
  expect(serialized).toEqual(input);
});

test('round-trip: parse then serialize should produce equivalent JSON', () => {
  const inputs = [
    { title: { _eq: 'test' } },
    {
      _or: [{ title: { _eq: 'test' } }, { title: { _eq: 'test2' } }],
    },
    {
      _and: [{ name: { _eq: 'John' } }, { age: { _gte: 18 } }],
    },
    { _not: { title: { _eq: 'test' } } },
    { author: { name: { _eq: 'John Doe' } } },
    { metadata: { _contains: { foo: 'bar' } } },
    { title: { _is_null: true } },
    {
      _not: {
        _or: [{ title: { _eq: 'test' } }, { age: { _gt: 32 } }],
      },
    },
  ];

  for (const input of inputs) {
    const parsed = parseRuleGroup(input);
    const serialized = serializeRuleGroup(parsed);
    expect(serialized).toEqual(input);
  }
});

test('round-trip: complex nested structure with relationship paths', () => {
  // When relationship paths (e.g. `author`) wrap a logical group, the parser
  // distributes the prefix into each condition's column. Serialization produces
  // a semantically equivalent structure where the prefix is on each condition
  // rather than factored out. Both are equivalent to Hasura.
  const input = {
    _or: [
      {
        author: {
          _and: [
            { name: { _eq: 'John Doe' } },
            { age: { _gte: '32' } },
            {
              _or: [{ name: { _eq: 'Mary Jane' } }, { age: { _lte: '48' } }],
            },
          ],
        },
      },
      { title: { _eq: 'test' } },
    ],
  };

  const parsed = parseRuleGroup(input);
  const serialized = serializeRuleGroup(parsed);

  expect(serialized).toEqual({
    _or: [
      {
        _and: [
          { author: { name: { _eq: 'John Doe' } } },
          { author: { age: { _gte: '32' } } },
          {
            _or: [
              { author: { name: { _eq: 'Mary Jane' } } },
              { author: { age: { _lte: '48' } } },
            ],
          },
        ],
      },
      { title: { _eq: 'test' } },
    ],
  });
});
