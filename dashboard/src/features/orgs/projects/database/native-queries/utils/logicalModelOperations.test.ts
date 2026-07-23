import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';
import {
  buildCreateLogicalModelMigration,
  buildDeleteLogicalModelMigration,
  buildEditLogicalModelMigration,
  buildEditLogicalModelSteps,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';

const original: LogicalModelItem = {
  name: 'invoice',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
  select_permissions: [
    { role: 'user', permission: { columns: '*', filter: { id: { _neq: '' } } } },
    { role: 'viewer', permission: { columns: ['id'], filter: {} } },
  ],
};

const updated: TrackLogicalModelArgs = {
  source: 'default',
  name: 'renamed_invoice',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    {
      name: 'tags',
      type: {
        array: { scalar: 'text', nullable: true },
        nullable: false,
      },
    },
  ],
};

describe('logical model operation builders', () => {
  it('builds create with inverse down', () => {
    const migration = buildCreateLogicalModelMigration(updated);
    expect(migration).toMatchObject({
      name: 'create_logical_model_renamed_invoice',
      datasource: 'default',
      skip_execution: false,
      up: [{ type: 'pg_track_logical_model', args: updated }],
      down: [
        {
          type: 'pg_untrack_logical_model',
          args: { source: 'default', name: updated.name },
        },
      ],
    });
  });

  it('builds an atomic-compatible mixed edit sequence preserving permissions', () => {
    expect(buildEditLogicalModelSteps(updated, original).map((step) => step.type)).toEqual([
      'pg_untrack_logical_model',
      'pg_track_logical_model',
      'pg_create_logical_model_select_permission',
      'pg_create_logical_model_select_permission',
    ]);
  });

  it('builds lossless edit down in inverse order', () => {
    const migration = buildEditLogicalModelMigration(updated, original);
    expect(migration.down.map((step) => step.type)).toEqual([
      'pg_drop_logical_model_select_permission',
      'pg_drop_logical_model_select_permission',
      'pg_untrack_logical_model',
      'pg_track_logical_model',
      'pg_create_logical_model_select_permission',
      'pg_create_logical_model_select_permission',
    ]);
    expect(migration.down.at(-3)).toEqual({
      type: 'pg_track_logical_model',
      args: { source: 'default', name: original.name, fields: original.fields },
    });
    expect(migration.down.at(-1)).toMatchObject({
      args: { name: original.name, role: 'viewer', permission: original.select_permissions?.[1].permission },
    });
  });

  it('builds lossless delete rollback with all permissions', () => {
    const migration = buildDeleteLogicalModelMigration(original);
    expect(migration.name).toBe('delete_logical_model_invoice');
    expect(migration.down).toHaveLength(3);
    expect(migration.down.map((step) => step.type)).toEqual([
      'pg_track_logical_model',
      'pg_create_logical_model_select_permission',
      'pg_create_logical_model_select_permission',
    ]);
  });
});
