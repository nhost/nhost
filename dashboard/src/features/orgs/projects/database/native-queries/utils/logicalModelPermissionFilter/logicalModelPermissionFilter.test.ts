import type {
  ConditionNode,
  GroupNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import {
  analyzeLogicalModelFilter,
  hasEmptyBooleanGroup,
  LOGICAL_MODEL_COMPARISON_OPERATORS,
  parseLogicalModelFilter,
  resolveLogicalModelFieldDescriptors,
  serializeLogicalModelFilter,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const profile: LogicalModelItem = {
  name: 'profile',
  fields: [
    { name: 'active', type: { scalar: 'boolean', nullable: false } },
    { name: 'displayName', type: { scalar: 'text', nullable: true } },
  ],
};
const author: LogicalModelItem = {
  name: 'author',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    {
      name: 'profile',
      type: { logical_model: 'profile', nullable: true },
    },
  ],
};

function fields(
  model: LogicalModelItem = author,
  models: LogicalModelItem[] = [author, profile],
) {
  return resolveLogicalModelFieldDescriptors(model, models);
}

function condition(
  id: string,
  column: string,
  operator: ConditionNode['operator'],
  value: unknown,
): ConditionNode {
  return { type: 'condition', id, column, operator, value };
}

function group(
  id: string,
  operator: GroupNode['operator'],
  children: GroupNode['children'],
): GroupNode {
  return { type: 'group', id, operator, children };
}

function expectCompatible(filter: Record<string, unknown>) {
  const result = analyzeLogicalModelFilter(filter, fields());
  expect(result).toMatchObject({ compatible: true });
  if (!result.compatible) {
    throw new Error('Expected a compatible filter');
  }
  expect(result.value).toEqual(filter);
  return result;
}

function expectIncompatible(filter: Record<string, unknown>, code: string) {
  const snapshot = JSON.stringify(filter);
  const result = analyzeLogicalModelFilter(filter, fields());
  expect(result).toMatchObject({
    compatible: false,
    errors: [expect.objectContaining({ code })],
  });
  expect(JSON.stringify(filter)).toBe(snapshot);
}

function comparisonValue(operator: string): unknown {
  if (operator === '_is_null') {
    return false;
  }
  if (operator === '_in' || operator === '_nin') {
    return ['one', 'two'];
  }
  return 'value';
}

describe('resolveLogicalModelFieldDescriptors', () => {
  it('returns scalar leaves as selectable and references as traversal-only', () => {
    expect(fields()).toEqual({
      descriptors: [
        {
          kind: 'scalar',
          name: 'id',
          path: 'id',
          nullable: false,
          selectable: true,
          scalar: 'uuid',
        },
        {
          kind: 'object',
          name: 'profile',
          path: 'profile',
          nullable: true,
          selectable: false,
          logicalModel: 'profile',
        },
        {
          kind: 'scalar',
          name: 'active',
          path: 'profile.active',
          nullable: false,
          selectable: true,
          scalar: 'boolean',
        },
        {
          kind: 'scalar',
          name: 'displayName',
          path: 'profile.displayName',
          nullable: true,
          selectable: true,
          scalar: 'text',
        },
      ],
      selectablePaths: ['id', 'profile.active', 'profile.displayName'],
      traversalPaths: ['profile'],
      issues: [],
    });
  });

  it('excludes arrays and unresolved references', () => {
    const model: LogicalModelItem = {
      name: 'result',
      fields: [
        {
          name: 'tags',
          type: {
            array: { scalar: 'text', nullable: false },
            nullable: false,
          },
        },
        {
          name: 'missing',
          type: { logical_model: 'absent', nullable: false },
        },
      ],
    };

    expect(fields(model, [model])).toMatchObject({
      selectablePaths: [],
      traversalPaths: [],
      issues: [
        { code: 'array', path: 'tags' },
        {
          code: 'unresolved-reference',
          path: 'missing',
          reference: 'absent',
        },
      ],
    });
  });

  it('resolves references per branch and stops cycles', () => {
    const left: LogicalModelItem = {
      name: 'left',
      fields: [
        { name: 'value', type: { scalar: 'text', nullable: false } },
        {
          name: 'right',
          type: { logical_model: 'right', nullable: false },
        },
      ],
    };
    const right: LogicalModelItem = {
      name: 'right',
      fields: [
        { name: 'value', type: { scalar: 'text', nullable: false } },
        {
          name: 'left',
          type: { logical_model: 'left', nullable: false },
        },
      ],
    };
    const root: LogicalModelItem = {
      name: 'root',
      fields: [
        { name: 'first', type: { logical_model: 'left', nullable: false } },
        { name: 'second', type: { logical_model: 'left', nullable: false } },
      ],
    };

    const result = fields(root, [root, left, right]);
    expect(result.selectablePaths).toEqual([
      'first.value',
      'first.right.value',
      'second.value',
      'second.right.value',
    ]);
    expect(result.issues).toEqual([
      { code: 'cycle', path: 'first.right.left', reference: 'left' },
      { code: 'cycle', path: 'second.right.left', reference: 'left' },
    ]);
  });

  it('excludes unsafe, duplicate, and dotted names without prototype access', () => {
    const model: LogicalModelItem = {
      name: 'unsafe',
      fields: [
        { name: '__proto__', type: { scalar: 'text', nullable: false } },
        { name: 'constructor', type: { scalar: 'text', nullable: false } },
        { name: '_and', type: { scalar: 'text', nullable: false } },
        { name: 'a.b', type: { scalar: 'text', nullable: false } },
        { name: 'same', type: { scalar: 'text', nullable: false } },
        { name: 'same', type: { scalar: 'uuid', nullable: false } },
      ],
    };

    expect(fields(model, [model])).toMatchObject({
      descriptors: [],
      selectablePaths: [],
      issues: [
        { code: 'unsafe-name', path: '__proto__' },
        { code: 'unsafe-name', path: 'constructor' },
        { code: 'unsafe-name', path: '_and' },
        { code: 'dotted-name', path: 'a.b' },
        { code: 'duplicate-field', path: 'same' },
        { code: 'duplicate-field', path: 'same' },
      ],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('logical-model filter admission', () => {
  it('admits every fixed comparison operator and preserves values', () => {
    const filter = {
      id: Object.fromEntries(
        LOGICAL_MODEL_COMPARISON_OPERATORS.map((operator) => [
          operator,
          comparisonValue(operator),
        ]),
      ),
    };

    expectCompatible(filter);
  });

  it.each([
    {},
    { _and: [] },
    { _or: [] },
    {
      _and: [
        { id: { _eq: 'one' } },
        { _or: [{ profile: { active: { _eq: true } } }] },
      ],
    },
    { _not: { _and: [{ id: { _eq: 'one' } }, { id: { _neq: 'two' } }] } },
  ])('admits exact lossless empty and nested shape %#', (filter) => {
    expectCompatible(filter);
  });

  const malformedBooleanCases: Array<[Record<string, unknown>, string]> = [
    [{ _and: [{}] }, 'empty-boolean-child'],
    [{ _or: [{}] }, 'empty-boolean-child'],
    [{ _not: {} }, 'empty-boolean-child'],
    [{ _and: [{ _not: {} }] }, 'empty-boolean-child'],
    [{ _and: {} }, 'malformed-boolean-group'],
    [{ _or: [true] }, 'malformed-boolean-group'],
    [{ _not: [] }, 'malformed-boolean-group'],
  ];

  it.each(malformedBooleanCases)(
    'classifies malformed Boolean shape %# as JSON-only',
    (filter, code) => {
      expectIncompatible(filter, code);
    },
  );

  const unsupportedCases: Array<[Record<string, unknown>, string]> = [
    [{ id: { _regex: 'x' } }, 'unknown-operator'],
    [{ _exists: {} }, 'unknown-operator'],
    [{ id: { _is_null: 'true' } }, 'noncanonical-is-null'],
    [{ id: { _is_null: 1 } }, 'noncanonical-is-null'],
    [{ unknown: { _eq: 1 } }, 'invalid-field'],
    [{ profile: [] }, 'invalid-field'],
  ];

  it.each(unsupportedCases)(
    'classifies unsupported filter %# without mutation',
    (filter, code) => {
      expectIncompatible(filter, code);
    },
  );

  it('rejects manually supplied array conditions during parsing', () => {
    const model: LogicalModelItem = {
      name: 'array_result',
      fields: [
        {
          name: 'tags',
          type: {
            array: { scalar: 'text', nullable: true },
            nullable: false,
          },
        },
      ],
    };
    const arrayFields = fields(model, [model]);

    expect(
      parseLogicalModelFilter({ tags: { _eq: ['one'] } }, arrayFields),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'invalid-field' }],
    });
  });

  it('rejects unsafe own keys and non-plain prototypes', () => {
    const unsafe = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(unsafe, '__proto__', {
      value: { polluted: true },
      enumerable: true,
    });
    expectIncompatible(unsafe, 'unsafe-key');

    const inherited = Object.create({ id: { _eq: 'inherited' } }) as Record<
      string,
      unknown
    >;
    const result = parseLogicalModelFilter(inherited, fields());
    expect(result).toMatchObject({
      success: false,
      errors: [{ code: 'unsafe-object' }],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('serializeLogicalModelFilter', () => {
  it.each(['_and', '_or'] as const)(
    'rejects empty %s authoring but preserves stored filters for display',
    (operator) => {
      const stored = { [operator]: [] };
      expectCompatible(stored);
      expect(parseLogicalModelFilter(stored, fields())).toMatchObject({
        success: true,
      });
      for (const node of [
        group('empty', operator, []),
        group('root', '_implicit', [
          condition('id', 'id', '_eq', 'one'),
          group('empty', operator, []),
        ]),
      ]) {
        expect(serializeLogicalModelFilter(node, fields())).toMatchObject({
          success: false,
          errors: [
            {
              code: 'malformed-boolean-group',
              message: `${operator} must contain at least one child.`,
            },
          ],
        });
      }
    },
  );

  it('merges implicit siblings recursively when collision-free', () => {
    const node = group('root', '_implicit', [
      condition('one', 'profile.active', '_eq', true),
      condition('two', 'profile.displayName', '_like', 'A%'),
      condition('three', 'id', '_neq', 'anonymous'),
    ]);

    expect(serializeLogicalModelFilter(node, fields())).toEqual({
      success: true,
      value: {
        profile: {
          active: { _eq: true },
          displayName: { _like: 'A%' },
        },
        id: { _neq: 'anonymous' },
      },
    });
  });

  it('uses explicit _and for duplicate conditions instead of dropping a child', () => {
    const node = group('root', '_implicit', [
      condition('one', 'id', '_eq', 'first'),
      condition('two', 'id', '_eq', 'second'),
    ]);

    expect(serializeLogicalModelFilter(node, fields())).toEqual({
      success: true,
      value: {
        _and: [{ id: { _eq: 'first' } }, { id: { _eq: 'second' } }],
      },
    });
  });

  it('returns structured validation errors and never serializes unsupported nodes', () => {
    const emptyNot = group('not', '_not', []);
    expect(serializeLogicalModelFilter(emptyNot, fields())).toMatchObject({
      success: false,
      errors: [{ code: 'malformed-boolean-group' }],
    });

    expect(
      serializeLogicalModelFilter(
        {
          type: 'exists',
          id: 'exists',
          schema: 'public',
          table: 'authors',
          where: group('where', '_implicit', []),
        },
        fields(),
      ),
    ).toMatchObject({
      success: false,
      errors: [{ code: 'invalid-node' }],
    });
  });
});

describe('hasEmptyBooleanGroup', () => {
  it.each([
    { filter: { _and: [] }, expected: true },
    { filter: { _or: [] }, expected: true },
    { filter: { _not: {} }, expected: true },
    { filter: { _and: [{ _or: [] }] }, expected: true },
    { filter: { _or: [{}] }, expected: true },
    { filter: { _and: [{}] }, expected: true },
    { filter: { _and: [{ id: { _eq: '1' } }, {}] }, expected: true },
    { filter: { _not: { _or: [{}] } }, expected: true },
    { filter: { payload: { _eq: { _and: [] } } }, expected: false },
    { filter: { payload: { _in: [{ _or: [] }] } }, expected: false },
    { filter: { _not: { _and: [] } }, expected: true },
    { filter: {}, expected: false },
    { filter: { id: { _eq: 'X-Hasura-User-Id' } }, expected: false },
    { filter: { _and: [{ id: { _eq: '1' } }] }, expected: false },
  ])('returns $expected for $filter', ({ filter, expected }) => {
    expect(hasEmptyBooleanGroup(filter)).toBe(expected);
  });
});
