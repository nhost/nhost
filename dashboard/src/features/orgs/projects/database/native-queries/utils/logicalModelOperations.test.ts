import {
  buildCreateLogicalModelMigration,
  buildDeleteLogicalModelMigration,
  buildEditLogicalModelMigration,
  buildEditLogicalModelSteps,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';
import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';

const original: LogicalModelItem = {
  name: 'invoice',
  description: '  External invoice description  ',
  fields: [
    {
      name: 'id',
      type: { scalar: 'uuid', nullable: false },
      description: '  External identifier description  ',
    },
  ],
  select_permissions: [
    {
      role: 'user',
      permission: { columns: '*', filter: { id: { _neq: '' } } },
    },
    { role: 'viewer', permission: { columns: ['id'], filter: {} } },
  ],
};

const updated: TrackLogicalModelArgs = {
  source: 'default',
  name: 'renamed_invoice',
  description: 'Updated invoice description',
  fields: [
    {
      name: 'id',
      type: { scalar: 'uuid', nullable: false },
      description: 'Updated identifier description',
    },
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
    expect(
      buildEditLogicalModelSteps(updated, original).map((step) => step.type),
    ).toEqual([
      'pg_untrack_logical_model',
      'pg_track_logical_model',
      'pg_create_logical_model_select_permission',
      'pg_create_logical_model_select_permission',
    ]);
  });

  it('builds lossless edit down in inverse permission order', () => {
    const migration = buildEditLogicalModelMigration(updated, original);

    expect(migration.down).toEqual([
      {
        type: 'pg_drop_logical_model_select_permission',
        args: {
          source: 'default',
          name: updated.name,
          role: 'viewer',
        },
      },
      {
        type: 'pg_drop_logical_model_select_permission',
        args: {
          source: 'default',
          name: updated.name,
          role: 'user',
        },
      },
      {
        type: 'pg_untrack_logical_model',
        args: { source: 'default', name: updated.name },
      },
      {
        type: 'pg_track_logical_model',
        args: {
          source: 'default',
          name: original.name,
          fields: original.fields,
          description: original.description,
        },
      },
      {
        type: 'pg_create_logical_model_select_permission',
        args: {
          source: 'default',
          name: original.name,
          role: 'user',
          permission: original.select_permissions?.[0].permission,
        },
      },
      {
        type: 'pg_create_logical_model_select_permission',
        args: {
          source: 'default',
          name: original.name,
          role: 'viewer',
          permission: original.select_permissions?.[1].permission,
        },
      },
    ]);
  });

  it('builds lossless delete rollback with exact descriptions and permissions', () => {
    const migration = buildDeleteLogicalModelMigration(original);

    expect(migration.name).toBe('delete_logical_model_invoice');
    expect(migration.down).toEqual([
      {
        type: 'pg_track_logical_model',
        args: {
          source: 'default',
          name: original.name,
          fields: original.fields,
          description: original.description,
        },
      },
      {
        type: 'pg_create_logical_model_select_permission',
        args: {
          source: 'default',
          name: original.name,
          role: 'user',
          permission: original.select_permissions?.[0].permission,
        },
      },
      {
        type: 'pg_create_logical_model_select_permission',
        args: {
          source: 'default',
          name: original.name,
          role: 'viewer',
          permission: original.select_permissions?.[1].permission,
        },
      },
    ]);
  });
});
