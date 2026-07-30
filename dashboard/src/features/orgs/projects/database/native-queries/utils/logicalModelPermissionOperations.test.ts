import {
  buildCreateLogicalModelPermissionMigration,
  buildDeleteLogicalModelPermissionMigration,
  buildEditLogicalModelPermissionMigration,
  buildEditLogicalModelPermissionSteps,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionOperations';
import type {
  CreateLogicalModelSelectPermissionArgs,
  LogicalModelSelectPermission,
} from '@/utils/hasura-api/generated/schemas';

const nestedFilter = {
  _and: [
    { id: { _eq: 'X-Hasura-User-Id' } },
    { profile: { active: { _eq: true } } },
  ],
};
const original: LogicalModelSelectPermission = {
  columns: ['id', 'profile'],
  filter: nestedFilter,
};
const args: CreateLogicalModelSelectPermissionArgs = {
  source: 'ignored',
  name: 'author_result',
  role: 'user',
  permission: { columns: '*', filter: {} },
};

describe('logical model permission operations', () => {
  it('preserves wildcard columns and an empty filter for create', () => {
    expect(buildCreateLogicalModelPermissionMigration(args)).toEqual({
      name: 'create_logical_model_select_permission_author_result_user',
      datasource: 'default',
      skip_execution: false,
      up: [
        {
          type: 'pg_create_logical_model_select_permission',
          args: { ...args, source: 'default' },
        },
      ],
      down: [
        {
          type: 'pg_drop_logical_model_select_permission',
          args: { source: 'default', name: args.name, role: args.role },
        },
      ],
    });
  });

  it('orders edit as drop then create', () => {
    expect(
      buildEditLogicalModelPermissionSteps(args).map((step) => step.type),
    ).toEqual([
      'pg_drop_logical_model_select_permission',
      'pg_create_logical_model_select_permission',
    ]);
  });

  it('restores exact subset columns and the complete prior filter', () => {
    const migration = buildEditLogicalModelPermissionMigration(args, original);
    expect(migration.down).toEqual([
      {
        type: 'pg_drop_logical_model_select_permission',
        args: { source: 'default', name: args.name, role: args.role },
      },
      {
        type: 'pg_create_logical_model_select_permission',
        args: {
          source: 'default',
          name: args.name,
          role: args.role,
          permission: original,
        },
      },
    ]);
  });

  it('recreates the exact permission when rolling back a delete', () => {
    expect(
      buildDeleteLogicalModelPermissionMigration(args.name, args.role, original)
        .down,
    ).toEqual([
      {
        type: 'pg_create_logical_model_select_permission',
        args: {
          source: 'default',
          name: args.name,
          role: args.role,
          permission: original,
        },
      },
    ]);
  });
});
