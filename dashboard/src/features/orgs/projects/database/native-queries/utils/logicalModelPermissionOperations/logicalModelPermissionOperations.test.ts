import {
  buildCreateLogicalModelPermissionStep,
  buildDropLogicalModelPermissionStep,
  buildEditLogicalModelPermissionSteps,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionOperations';
import type { CreateLogicalModelSelectPermissionArgs } from '@/utils/hasura-api/generated/schemas';

const nestedFilter = {
  _and: [
    { id: { _eq: 'X-Hasura-User-Id' } },
    { profile: { active: { _eq: true } } },
  ],
};
const args: CreateLogicalModelSelectPermissionArgs = {
  source: 'ignored',
  name: 'author_result',
  role: 'user',
  permission: { columns: ['id', 'profile'], filter: nestedFilter },
};

describe('logical model permission operations', () => {
  it('builds an exact create step and forces the default source', () => {
    expect(buildCreateLogicalModelPermissionStep(args)).toEqual({
      type: 'pg_create_logical_model_select_permission',
      args: { ...args, source: 'default' },
    });
  });

  it('builds an exact drop step', () => {
    expect(buildDropLogicalModelPermissionStep(args.name, args.role)).toEqual({
      type: 'pg_drop_logical_model_select_permission',
      args: { source: 'default', name: args.name, role: args.role },
    });
  });

  it('builds edit steps in exact drop-then-create order', () => {
    expect(buildEditLogicalModelPermissionSteps(args)).toEqual([
      {
        type: 'pg_drop_logical_model_select_permission',
        args: { source: 'default', name: args.name, role: args.role },
      },
      {
        type: 'pg_create_logical_model_select_permission',
        args: { ...args, source: 'default' },
      },
    ]);
  });
});
