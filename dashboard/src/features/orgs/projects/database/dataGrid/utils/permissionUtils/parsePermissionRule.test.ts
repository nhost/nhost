import { vi } from 'vitest';
import parsePermissionRule from './parsePermissionRule';

describe('parsePermissionRule', () => {
  it('returns an empty array for an empty object', () => {
    expect(parsePermissionRule({})).toEqual([]);
  });

  it('returns an empty array and logs an error when the value is a primitive (not an object)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parsePermissionRule({ invalid: 'string' })).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'parsePermissionRule: unexpected primitive value for key "invalid":',
      'string',
    );
    consoleSpy.mockRestore();
  });

  it('parses a simple equality condition', () => {
    const result = parsePermissionRule({ col: { _eq: 'val' } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col',
      operator: '_eq',
      value: 'val',
    });
  });

  it('parses _in with an array value', () => {
    const result = parsePermissionRule({ col: { _in: ['a', 'b'] } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col',
      operator: '_in',
      value: ['a', 'b'],
    });
  });

  it('parses _in with a string value (session variable)', () => {
    const result = parsePermissionRule({
      col: { _in: 'X-Hasura-Allowed-Roles' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col',
      operator: '_in',
      value: 'X-Hasura-Allowed-Roles',
    });
  });

  it('parses a JSONB _contains condition', () => {
    const result = parsePermissionRule({
      metadata: { _contains: { key: 'val' } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'metadata',
      operator: '_contains',
      value: { key: 'val' },
    });
  });

  it('normalizes _is_null boolean true to string "true"', () => {
    const result = parsePermissionRule({ col: { _is_null: true } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col',
      operator: '_is_null',
      value: 'true',
    });
  });

  it('normalizes _is_null boolean false to string "false"', () => {
    const result = parsePermissionRule({ col: { _is_null: false } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col',
      operator: '_is_null',
      value: 'false',
    });
  });

  it('preserves _is_null string "true"', () => {
    const result = parsePermissionRule({ col: { _is_null: 'true' } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col',
      operator: '_is_null',
      value: 'true',
    });
  });

  it('preserves _is_null string "false"', () => {
    const result = parsePermissionRule({ col: { _is_null: 'false' } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col',
      operator: '_is_null',
      value: 'false',
    });
  });

  it('parses _is_null inside a relationship as a RelationshipNode', () => {
    const result = parsePermissionRule({
      author: { active: { _is_null: true } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'author',
      child: {
        type: 'group',
        operator: '_implicit',
        children: [
          {
            type: 'condition',
            column: 'active',
            operator: '_is_null',
            value: 'true',
          },
        ],
      },
    });
  });

  it('parses a top-level _and group', () => {
    const result = parsePermissionRule({
      _and: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_and',
      children: [
        { type: 'condition', column: 'col', operator: '_eq', value: 'a' },
        { type: 'condition', column: 'col', operator: '_eq', value: 'b' },
      ],
    });
  });

  it('parses a top-level _or group', () => {
    const result = parsePermissionRule({
      _or: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_or',
      children: [
        { type: 'condition', column: 'col', operator: '_eq', value: 'a' },
        { type: 'condition', column: 'col', operator: '_eq', value: 'b' },
      ],
    });
  });

  it('parses _or nested inside _and', () => {
    const result = parsePermissionRule({
      _and: [
        { col: { _eq: 'a' } },
        { _or: [{ col2: { _eq: 'b' } }, { col2: { _eq: 'c' } }] },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_and',
      children: [
        { type: 'condition', column: 'col', operator: '_eq', value: 'a' },
        {
          type: 'group',
          operator: '_or',
          children: [
            { type: 'condition', column: 'col2', operator: '_eq', value: 'b' },
            { type: 'condition', column: 'col2', operator: '_eq', value: 'c' },
          ],
        },
      ],
    });
  });

  it('parses a top-level _not wrapping a condition', () => {
    const result = parsePermissionRule({ _not: { col: { _eq: 'val' } } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_not',
      children: [
        { type: 'condition', column: 'col', operator: '_eq', value: 'val' },
      ],
    });
  });

  it('parses _not wrapping multiple conditions', () => {
    const result = parsePermissionRule({
      _not: { col1: { _eq: 'a' }, col2: { _eq: 'b' } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_not',
      children: [
        { type: 'condition', column: 'col1', operator: '_eq', value: 'a' },
        { type: 'condition', column: 'col2', operator: '_eq', value: 'b' },
      ],
    });
  });

  it('parses _not wrapping an _or group', () => {
    const result = parsePermissionRule({
      _not: { _or: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }] },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_not',
      children: [
        {
          type: 'group',
          operator: '_or',
          children: [
            { type: 'condition', column: 'col', operator: '_eq', value: 'a' },
            { type: 'condition', column: 'col', operator: '_eq', value: 'b' },
          ],
        },
      ],
    });
  });

  it('parses a top-level _exists', () => {
    const result = parsePermissionRule({
      _exists: {
        _table: { schema: 'public', name: 'users' },
        _where: { id: { _eq: 'X-Hasura-User-Id' } },
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'exists',
      schema: 'public',
      table: 'users',
      where: {
        type: 'group',
        operator: '_implicit',
        children: [
          {
            type: 'condition',
            column: 'id',
            operator: '_eq',
            value: 'X-Hasura-User-Id',
          },
        ],
      },
    });
  });

  it('parses _exists where as a GroupNode, not an array', () => {
    const result = parsePermissionRule({
      _exists: {
        _table: { schema: 'public', name: 'users' },
        _where: { id: { _eq: 'X-Hasura-User-Id' } },
      },
    });
    const existsNode = result[0] as { where: unknown };
    expect(Array.isArray(existsNode.where)).toBe(false);
    expect(existsNode.where).toHaveProperty('children');
    expect(existsNode.where).toHaveProperty('operator');
  });

  it('parses _exists with an empty _where', () => {
    const result = parsePermissionRule({
      _exists: {
        _table: { schema: 'public', name: 'users' },
        _where: {},
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'exists',
      schema: 'public',
      table: 'users',
      where: {
        type: 'group',
        operator: '_implicit',
        children: [],
      },
    });
  });

  it('parses _exists nested inside _or', () => {
    const result = parsePermissionRule({
      _or: [
        { col: { _eq: 'a' } },
        {
          _exists: {
            _table: { schema: 'public', name: 'users' },
            _where: { id: { _eq: 'X-Hasura-User-Id' } },
          },
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_or',
      children: [
        { type: 'condition', column: 'col', operator: '_eq', value: 'a' },
        {
          type: 'exists',
          schema: 'public',
          table: 'users',
          where: {
            type: 'group',
            operator: '_implicit',
            children: [
              {
                type: 'condition',
                column: 'id',
                operator: '_eq',
                value: 'X-Hasura-User-Id',
              },
            ],
          },
        },
      ],
    });
  });

  it('parses _not nested inside _and', () => {
    const result = parsePermissionRule({
      _and: [{ col: { _eq: 'a' } }, { _not: { col: { _eq: 'b' } } }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_and',
      children: [
        { type: 'condition', column: 'col', operator: '_eq', value: 'a' },
        {
          type: 'group',
          operator: '_not',
          children: [
            { type: 'condition', column: 'col', operator: '_eq', value: 'b' },
          ],
        },
      ],
    });
  });

  it('parses a relationship traversal into a RelationshipNode', () => {
    const result = parsePermissionRule({ author: { name: { _eq: 'John' } } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'author',
      child: {
        type: 'group',
        operator: '_implicit',
        children: [
          {
            type: 'condition',
            column: 'name',
            operator: '_eq',
            value: 'John',
          },
        ],
      },
    });
  });

  it('parses a deep relationship traversal into nested RelationshipNodes', () => {
    const result = parsePermissionRule({
      books: { author: { id: { _eq: 'X-Hasura-User-Id' } } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'books',
      child: {
        type: 'group',
        operator: '_implicit',
        children: [
          {
            type: 'relationship',
            relationship: 'author',
            child: {
              type: 'group',
              operator: '_implicit',
              children: [
                {
                  type: 'condition',
                  column: 'id',
                  operator: '_eq',
                  value: 'X-Hasura-User-Id',
                },
              ],
            },
          },
        ],
      },
    });
  });

  it('parses a three-level deep path into nested RelationshipNodes', () => {
    const result = parsePermissionRule({ a: { b: { c: { _eq: 'val' } } } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'a',
      child: {
        type: 'group',
        operator: '_implicit',
        children: [
          {
            type: 'relationship',
            relationship: 'b',
            child: {
              type: 'group',
              operator: '_implicit',
              children: [
                {
                  type: 'condition',
                  column: 'c',
                  operator: '_eq',
                  value: 'val',
                },
              ],
            },
          },
        ],
      },
    });
  });

  it('parses a relationship wrapping _and into a RelationshipNode', () => {
    const result = parsePermissionRule({
      author: { _and: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'author',
      child: {
        type: 'group',
        operator: '_and',
        children: [
          { type: 'condition', column: 'name', operator: '_eq', value: 'John' },
          { type: 'condition', column: 'age', operator: '_gte', value: 30 },
        ],
      },
    });
  });

  it('parses a relationship wrapping _or into a RelationshipNode', () => {
    const result = parsePermissionRule({
      author: { _or: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'author',
      child: {
        type: 'group',
        operator: '_or',
        children: [
          { type: 'condition', column: 'name', operator: '_eq', value: 'John' },
          { type: 'condition', column: 'age', operator: '_gte', value: 30 },
        ],
      },
    });
  });

  it('parses a relationship wrapping _not into a RelationshipNode', () => {
    const result = parsePermissionRule({
      author: { _not: { name: { _eq: 'John' } } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'author',
      child: {
        type: 'group',
        operator: '_not',
        children: [
          { type: 'condition', column: 'name', operator: '_eq', value: 'John' },
        ],
      },
    });
  });

  it('parses a deep relationship path wrapping _and into nested RelationshipNodes', () => {
    const result = parsePermissionRule({
      publishers: { countries: { _and: [{ name: { _eq: 'France' } }] } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'publishers',
      child: {
        type: 'group',
        operator: '_implicit',
        children: [
          {
            type: 'relationship',
            relationship: 'countries',
            child: {
              type: 'group',
              operator: '_and',
              children: [
                {
                  type: 'condition',
                  column: 'name',
                  operator: '_eq',
                  value: 'France',
                },
              ],
            },
          },
        ],
      },
    });
  });

  it('parses multiple top-level keys as a flat list of conditions (implicit _and)', () => {
    const result = parsePermissionRule({
      col1: { _eq: 'a' },
      col2: { _eq: 'b' },
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: 'condition',
      column: 'col1',
      operator: '_eq',
      value: 'a',
    });
    expect(result[1]).toMatchObject({
      type: 'condition',
      column: 'col2',
      operator: '_eq',
      value: 'b',
    });
  });

  it('parses a relationship with multiple conditions as a RelationshipNode', () => {
    const result = parsePermissionRule({
      author: { name: { _eq: 'John' }, age: { _gte: 30 } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'author',
      child: {
        type: 'group',
        operator: '_implicit',
        children: [
          {
            type: 'condition',
            column: 'name',
            operator: '_eq',
            value: 'John',
          },
          {
            type: 'condition',
            column: 'age',
            operator: '_gte',
            value: 30,
          },
        ],
      },
    });
  });

  it('parses a complex _or containing a RelationshipNode and a condition', () => {
    const result = parsePermissionRule({
      _or: [
        {
          author: { _and: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
        },
        { title: { _eq: 'test' } },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_or',
      children: [
        {
          type: 'relationship',
          relationship: 'author',
          child: {
            type: 'group',
            operator: '_and',
            children: [
              {
                type: 'condition',
                column: 'name',
                operator: '_eq',
                value: 'John',
              },
              { type: 'condition', column: 'age', operator: '_gte', value: 30 },
            ],
          },
        },
        { type: 'condition', column: 'title', operator: '_eq', value: 'test' },
      ],
    });
  });

  it('parses an empty _and group inside a relationship', () => {
    const result = parsePermissionRule({ author: { _and: [] } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'relationship',
      relationship: 'author',
      child: {
        type: 'group',
        operator: '_and',
        children: [],
      },
    });
  });

  it('parses double _not (negation of a negation)', () => {
    const result = parsePermissionRule({
      _not: { _not: { col: { _eq: 'val' } } },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_not',
      children: [
        {
          type: 'group',
          operator: '_not',
          children: [
            { type: 'condition', column: 'col', operator: '_eq', value: 'val' },
          ],
        },
      ],
    });
  });

  it('parses _not wrapping _or with a nested _and sub-group', () => {
    const result = parsePermissionRule({
      _not: {
        _or: [
          { title: { _eq: 'test' } },
          { _and: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
        ],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'group',
      operator: '_not',
      children: [
        {
          type: 'group',
          operator: '_or',
          children: [
            {
              type: 'condition',
              column: 'title',
              operator: '_eq',
              value: 'test',
            },
            {
              type: 'group',
              operator: '_and',
              children: [
                {
                  type: 'condition',
                  column: 'name',
                  operator: '_eq',
                  value: 'John',
                },
                {
                  type: 'condition',
                  column: 'age',
                  operator: '_gte',
                  value: 30,
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
