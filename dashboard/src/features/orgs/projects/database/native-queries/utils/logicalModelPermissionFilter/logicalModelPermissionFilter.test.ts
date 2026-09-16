import { getAvailableOperators } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/getAvailableOperators';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  type GroupNode,
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import validationSchema from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/validationSchema';
import {
  normalizeLogicalModelScalar,
  resolveLogicalModelFieldDescriptors,
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
    { name: 'bio', type: { scalar: 'character varying', nullable: true } },
    { name: 'metadata', type: { scalar: 'json', nullable: true } },
    {
      name: 'tags',
      type: {
        array: { scalar: 'text', nullable: false },
        nullable: false,
      },
    },
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

function permissionValues(filter: GroupNode, rowCheckType = 'custom') {
  return {
    rowCheckType,
    columns: ['id'],
    filter,
  };
}

function condition(
  column: string,
  operator: HasuraOperator,
  value: unknown,
): GroupNode {
  return {
    type: 'group',
    id: 'root',
    operator: '_implicit',
    children: [
      {
        type: 'condition',
        id: 'condition',
        column,
        operator,
        value,
      },
    ],
  };
}

describe('resolveLogicalModelFieldDescriptors', () => {
  it('returns scalar leaves as selectable and references as traversal-only', () => {
    const result = fields();

    expect(
      result.descriptors
        .filter(({ kind, selectable }) => kind === 'scalar' && selectable)
        .map(({ path }) => path),
    ).toEqual([
      'id',
      'bio',
      'metadata',
      'profile.active',
      'profile.displayName',
    ]);
    expect(
      result.descriptors
        .filter(({ kind, selectable }) => kind === 'object' && !selectable)
        .map(({ path }) => path),
    ).toEqual(['profile']);
    expect(result.issues).toEqual([{ code: 'array', path: 'tags' }]);
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

    const result = fields(model, [model]);

    expect(result.descriptors).toEqual([]);
    expect(result.issues).toEqual([
      { code: 'array', path: 'tags' },
      {
        code: 'unresolved-reference',
        path: 'missing',
        reference: 'absent',
      },
    ]);
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
    expect(
      result.descriptors
        .filter(({ kind, selectable }) => kind === 'scalar' && selectable)
        .map(({ path }) => path),
    ).toEqual([
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

  it('excludes unsafe, duplicate, and dotted names', () => {
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

    const result = fields(model, [model]);

    expect(result.descriptors).toEqual([]);
    expect(result.issues).toEqual([
      { code: 'unsafe-name', path: '__proto__' },
      { code: 'unsafe-name', path: 'constructor' },
      { code: 'unsafe-name', path: '_and' },
      { code: 'dotted-name', path: 'a.b' },
      { code: 'duplicate-field', path: 'same' },
      { code: 'duplicate-field', path: 'same' },
    ]);
  });
});

describe('logical-model permission validation', () => {
  it('accepts canonical nested objects and shared value conventions losslessly', async () => {
    const stored = {
      profile: { active: { _is_null: true } },
      id: {
        _in: 'X-Hasura-Allowed-Ids',
        _nin: 'X-Hasura-Blocked-Ids',
      },
    };
    const tree = wrapPermissionsInAGroup(stored);
    const relationship = tree.children.find(
      (child) => child.type === 'relationship',
    );
    expect(relationship).toMatchObject({
      relationship: 'profile',
      child: {
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

    await expect(
      validationSchema.validate(permissionValues(tree)),
    ).resolves.toBeDefined();
    expect(serializeNode(tree)).toEqual(stored);
  });

  it('allows the server to validate whether a field exists', async () => {
    await expect(
      validationSchema.validate(
        permissionValues(condition('missing', '_eq', 'x')),
      ),
    ).resolves.toBeDefined();
  });

  it.each([
    ['bare string', 'bio'],
    ['same-scope array', ['bio']],
    ['root-relative array', ['$', 'bio']],
  ])('accepts a %s column comparison reference', async (_label, reference) => {
    await expect(
      validationSchema.validate(
        permissionValues(condition('id', '_ceq', reference)),
      ),
    ).resolves.toBeDefined();
  });

  it('strips the filter when row checks are disabled', async () => {
    const result = await validationSchema.validate(
      permissionValues(condition('missing', '_like', 'x'), 'none'),
    );
    expect(result).not.toHaveProperty('filter');
  });
});

describe('logical-model scalar normalization', () => {
  it.each([
    ['text', 'text'],
    ['character varying', 'varchar'],
    ['character', 'bpchar'],
    ['citext', 'text'],
    ['json', 'jsonb'],
    ['jsonb', 'jsonb'],
    ['custom_scalar', 'custom_scalar'],
  ])('normalizes %s to %s before selecting operators', (raw, normalized) => {
    expect(normalizeLogicalModelScalar(raw)).toBe(normalized);
    expect(getAvailableOperators(normalizeLogicalModelScalar(raw))).toEqual(
      getAvailableOperators(normalized),
    );
  });
});
