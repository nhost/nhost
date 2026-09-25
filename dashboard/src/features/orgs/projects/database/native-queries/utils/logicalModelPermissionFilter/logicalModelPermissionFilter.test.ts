import { getAvailableOperators } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/getAvailableOperators';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  type GroupNode,
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { postgresTypeGroups } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import validationSchema from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/validationSchema';
import {
  normalizeLogicalModelScalar,
  resolveLogicalModelFieldDescriptors,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

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

function fields(model: LogicalModelItem = author) {
  return resolveLogicalModelFieldDescriptors(model);
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
  it('returns only the model’s own scalar fields', () => {
    expect(fields()).toEqual([
      { name: 'id', nullable: false, scalar: 'uuid' },
      { name: 'bio', nullable: true, scalar: 'character varying' },
      { name: 'metadata', nullable: true, scalar: 'json' },
    ]);
  });

  it('skips array and object fields, even when an object has no referenced model', () => {
    const model: LogicalModelItem = {
      name: 'result',
      fields: [
        { name: 'value', type: { scalar: 'text', nullable: false } },
        {
          name: 'tags',
          type: {
            array: { scalar: 'text', nullable: false },
            nullable: false,
          },
        },
        { name: 'missing', type: { logical_model: 'absent', nullable: false } },
      ],
    };

    expect(fields(model)).toEqual([
      { name: 'value', nullable: false, scalar: 'text' },
    ]);
  });

  it('does not traverse references, including cycles', () => {
    const model: LogicalModelItem = {
      name: 'result',
      fields: [
        { name: 'id', type: { scalar: 'integer', nullable: false } },
        { name: 'self', type: { logical_model: 'result', nullable: false } },
      ],
    };

    expect(fields(model)).toEqual([
      { name: 'id', nullable: false, scalar: 'integer' },
    ]);
  });

  it('includes fields with valid leading underscores', () => {
    const model: LogicalModelItem = {
      name: 'result',
      fields: [{ name: '_private', type: { scalar: 'text', nullable: false } }],
    };

    expect(fields(model)).toEqual([
      { name: '_private', nullable: false, scalar: 'text' },
    ]);
  });
});

describe('logical-model permission validation', () => {
  it('accepts root scalar conditions and shared value conventions losslessly', async () => {
    const stored = {
      id: {
        _in: 'X-Hasura-Allowed-Ids',
        _nin: 'X-Hasura-Blocked-Ids',
      },
      bio: { _is_null: true },
    };
    const tree = wrapPermissionsInAGroup(stored);

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
    ['TEXT', 'text'],
    ['character varying', 'varchar'],
    ['CHARACTER VARYING', 'varchar'],
    ['character', 'bpchar'],
    ['citext', 'citext'],
    ['json', 'json'],
    ['jsonb', 'jsonb'],
    ['custom_scalar', 'custom_scalar'],
  ])('normalizes %s to %s before selecting operators', (raw, normalized) => {
    expect(normalizeLogicalModelScalar(raw)).toBe(normalized);
    expect(getAvailableOperators(normalizeLogicalModelScalar(raw))).toEqual(
      getAvailableOperators(normalized),
    );
  });

  const TABLE_UDT_NAME_OVERRIDES: Readonly<Record<string, string>> = {
    'character varying': 'varchar',
  };
  const TABLE_OPERATOR_PARITY_CASES = [
    ...postgresTypeGroups.map(({ label, value }) => ({
      label,
      tableUdtName: TABLE_UDT_NAME_OVERRIDES[label] ?? value,
    })),
    { label: 'citext', tableUdtName: 'citext' },
  ];

  it.each(TABLE_OPERATOR_PARITY_CASES)(
    'matches table operators for $label',
    ({ label, tableUdtName }) => {
      expect(getAvailableOperators(normalizeLogicalModelScalar(label))).toEqual(
        getAvailableOperators(tableUdtName),
      );
    },
  );
});
