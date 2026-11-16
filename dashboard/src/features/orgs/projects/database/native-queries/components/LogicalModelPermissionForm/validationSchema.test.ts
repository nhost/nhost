import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  type GroupNode,
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import validationSchema from './validationSchema';

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

describe('validationSchema', () => {
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
