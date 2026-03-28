import { v4 as uuidv4 } from 'uuid';
import parsePermissionRule, {
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/parsePermissionRule';
import ruleNodesToPermission, {
  unWrapRuleNodes,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/ruleNodesToPermission';
import type {
  ConditionNode,
  ExistsNode,
  GroupNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';

function condition(
  column: string,
  operator: string,
  value: unknown,
): ConditionNode {
  return {
    type: 'condition',
    id: uuidv4(),
    column,
    operator: operator as ConditionNode['operator'],
    value,
  };
}

function group(
  operator: GroupNode['operator'],
  children: GroupNode['children'],
): GroupNode {
  return { type: 'group', id: uuidv4(), operator, children };
}

function roundTrip(input: Record<string, unknown>): Record<string, unknown> {
  return ruleNodesToPermission(parsePermissionRule(input));
}

function uiRoundTrip(input: Record<string, unknown>): Record<string, unknown> {
  return unWrapRuleNodes(wrapPermissionsInAGroup(input));
}

describe('ruleNodesToPermission round-trip', () => {
  it('round-trips an empty object', () => {
    expect(roundTrip({})).toEqual({});
  });

  it('round-trips a simple equality condition', () => {
    const input = { col: { _eq: 'val' } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _in with an array value', () => {
    const input = { col: { _in: ['a', 'b'] } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _in with a string session variable', () => {
    const input = { col: { _in: 'X-Hasura-Allowed-Roles' } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a JSONB _contains condition', () => {
    const input = { metadata: { _contains: { key: 'val' } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _is_null true (boolean form)', () => {
    const input = { col: { _is_null: true } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _is_null false (boolean form)', () => {
    const input = { col: { _is_null: false } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a top-level _and group', () => {
    const input = { _and: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }] };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a top-level _or group', () => {
    const input = { _or: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }] };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _or nested inside _and', () => {
    const input = {
      _and: [
        { col: { _eq: 'a' } },
        { _or: [{ col2: { _eq: 'b' } }, { col2: { _eq: 'c' } }] },
      ],
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _not wrapping a condition', () => {
    const input = { _not: { col: { _eq: 'val' } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _not wrapping multiple conditions', () => {
    const input = { _not: { col1: { _eq: 'a' }, col2: { _eq: 'b' } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _not wrapping an _or group', () => {
    const input = {
      _not: { _or: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }] },
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _not nested inside _and', () => {
    const input = {
      _and: [{ col: { _eq: 'a' } }, { _not: { col: { _eq: 'b' } } }],
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a top-level _exists', () => {
    const input = {
      _exists: {
        _table: { schema: 'public', name: 'users' },
        _where: { id: { _eq: 'X-Hasura-User-Id' } },
      },
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _exists nested inside _or', () => {
    const input = {
      _or: [
        { col: { _eq: 'a' } },
        {
          _exists: {
            _table: { schema: 'public', name: 'users' },
            _where: { id: { _eq: 'X-Hasura-User-Id' } },
          },
        },
      ],
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a relationship traversal', () => {
    const input = { author: { name: { _eq: 'John' } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a deep relationship traversal', () => {
    const input = { books: { author: { id: { _eq: 'X-Hasura-User-Id' } } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a relationship wrapping _and (RelationshipNode)', () => {
    const input = {
      author: { _and: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a relationship wrapping _or (RelationshipNode)', () => {
    const input = {
      author: { _or: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a relationship wrapping _not (RelationshipNode)', () => {
    const input = { author: { _not: { name: { _eq: 'John' } } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a deep relationship path wrapping _and (RelationshipNode)', () => {
    const input = {
      publishers: { countries: { _and: [{ name: { _eq: 'France' } }] } },
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips multiple top-level keys (implicit _and)', () => {
    const input = { col1: { _eq: 'a' }, col2: { _eq: 'b' } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a relationship with multiple conditions (deep merge)', () => {
    const input = { author: { name: { _eq: 'John' }, age: { _gte: 30 } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a complex _or containing a RelationshipNode and a condition', () => {
    const input = {
      _or: [
        {
          author: { _and: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
        },
        { title: { _eq: 'test' } },
      ],
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips an empty _and group inside a relationship', () => {
    const input = { author: { _and: [] } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips double _not (negation of a negation)', () => {
    const input = { _not: { _not: { col: { _eq: 'val' } } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _not wrapping _or with a nested _and sub-group', () => {
    const input = {
      _not: {
        _or: [
          { title: { _eq: 'test' } },
          { _and: [{ name: { _eq: 'John' } }, { age: { _gte: 30 } }] },
        ],
      },
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _is_null inside a relationship', () => {
    const input = { author: { active: { _is_null: true } } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips _exists with an empty _where', () => {
    const input = {
      _exists: {
        _table: { schema: 'public', name: 'users' },
        _where: {},
      },
    };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a three-level deep relationship path', () => {
    const input = { a: { b: { c: { _eq: 'val' } } } };
    expect(roundTrip(input)).toEqual(input);
  });
});

describe('ruleNodesToPermission unit', () => {
  it('returns an empty object for an empty array', () => {
    expect(ruleNodesToPermission([])).toEqual({});
  });

  it('serializes _is_null string "true" as boolean true', () => {
    expect(
      ruleNodesToPermission([condition('col', '_is_null', 'true')]),
    ).toEqual({
      col: { _is_null: true },
    });
  });

  it('serializes _is_null string "false" as boolean false', () => {
    expect(
      ruleNodesToPermission([condition('col', '_is_null', 'false')]),
    ).toEqual({
      col: { _is_null: false },
    });
  });

  it('serializes _not with a single child without wrapping in _and', () => {
    expect(
      ruleNodesToPermission([group('_not', [condition('col', '_eq', 'val')])]),
    ).toEqual({
      _not: { col: { _eq: 'val' } },
    });
  });

  it('serializes _not with multiple children by merging them into a single object', () => {
    expect(
      ruleNodesToPermission([
        group('_not', [
          condition('col1', '_eq', 'a'),
          condition('col2', '_eq', 'b'),
        ]),
      ]),
    ).toEqual({ _not: { col1: { _eq: 'a' }, col2: { _eq: 'b' } } });
  });

  it('serializes a nested _implicit group by flattening its children (no _implicit key in output)', () => {
    expect(
      ruleNodesToPermission([
        group('_and', [
          condition('col1', '_eq', 'a'),
          group('_implicit', [condition('col2', '_eq', 'b')]),
        ]),
      ]),
    ).toEqual({
      _and: [{ col1: { _eq: 'a' } }, { col2: { _eq: 'b' } }],
    });
  });

  it('serializes a nested _implicit group with mixed conditions and exists', () => {
    const existsNode: ExistsNode = {
      type: 'exists',
      id: uuidv4(),
      schema: 'public',
      table: 'author',
      where: group('_implicit', [condition('name', '_eq', 'John')]),
    };

    expect(
      ruleNodesToPermission([
        group('_and', [
          condition('ident', '_gt', '45'),
          condition('uniqueConstraints', '_eq', 'Hello'),
          group('_implicit', [
            condition('ident', '_in', ['12', '34']),
            existsNode,
          ]),
        ]),
      ]),
    ).toEqual({
      _and: [
        { ident: { _gt: '45' } },
        { uniqueConstraints: { _eq: 'Hello' } },
        {
          ident: { _in: ['12', '34'] },
          _exists: {
            _table: { schema: 'public', name: 'author' },
            _where: { name: { _eq: 'John' } },
          },
        },
      ],
    });
  });
});

describe('UI round-trip (wrapPermissionsInAGroup → unWrapRuleNodes)', () => {
  it('round-trips an empty object', () => {
    expect(uiRoundTrip({})).toEqual({});
  });

  it('round-trips a flat permission object without adding an _and wrapper', () => {
    const input = { col: { _eq: 'val' } };
    expect(uiRoundTrip(input)).toEqual(input);
  });

  it('round-trips multiple flat keys without adding an _and wrapper', () => {
    const input = { col1: { _eq: 'a' }, col2: { _eq: 'b' } };
    expect(uiRoundTrip(input)).toEqual(input);
  });

  it('round-trips an explicit _and without double-wrapping', () => {
    const input = { _and: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }] };
    expect(uiRoundTrip(input)).toEqual(input);
  });

  it('round-trips an explicit _or without double-wrapping', () => {
    const input = { _or: [{ col: { _eq: 'a' } }, { col: { _eq: 'b' } }] };
    expect(uiRoundTrip(input)).toEqual(input);
  });

  it('round-trips a _not group', () => {
    const input = { _not: { col: { _eq: 'val' } } };
    expect(uiRoundTrip(input)).toEqual(input);
  });

  it('round-trips an _exists with a flat _where', () => {
    const input = {
      _exists: {
        _table: { schema: 'public', name: 'users' },
        _where: { id: { _eq: 'X-Hasura-User-Id' } },
      },
    };
    expect(uiRoundTrip(input)).toEqual(input);
  });

  it('round-trips an _exists with an empty _where', () => {
    const input = {
      _exists: {
        _table: { schema: 'public', name: 'users' },
        _where: {},
      },
    };
    expect(uiRoundTrip(input)).toEqual(input);
  });

  it('round-trips a complex permission matching the shape produced by the UI', () => {
    const input = {
      _and: [
        { ident: { _gt: '45' } },
        { uniqueConstraints: { _eq: 'Hello' } },
        { ident: { _in: ['12', '34', '56'] } },
        {
          _exists: {
            _table: { schema: 'public', name: 'author' },
            _where: { name: { _eq: 'John' } },
          },
        },
      ],
    };
    expect(uiRoundTrip(input)).toEqual(input);
  });
});
