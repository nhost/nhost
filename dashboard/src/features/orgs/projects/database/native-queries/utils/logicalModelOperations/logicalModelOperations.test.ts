import {
  buildEditLogicalModelSteps,
  buildPermissionSteps,
  buildTrackStep,
  buildUntrackStep,
  toTrackLogicalModelArgs,
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
  ],
};

describe('logical model metadata operation builders', () => {
  it('builds canonical track and untrack steps', () => {
    expect(buildTrackStep(updated)).toEqual({
      type: 'pg_track_logical_model',
      args: updated,
    });
    expect(buildUntrackStep(updated.name)).toEqual({
      type: 'pg_untrack_logical_model',
      args: { source: 'default', name: updated.name },
    });
    expect(toTrackLogicalModelArgs(original)).toEqual({
      source: 'default',
      name: original.name,
      description: original.description,
      fields: original.fields,
    });
  });

  it('preserves permission definitions when recreating them', () => {
    expect(buildPermissionSteps(original)).toEqual([
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

  it('builds only untrack, track, and permission recreation for edits', () => {
    const steps = buildEditLogicalModelSteps(updated, original);

    expect(steps.map((step) => step.type)).toEqual([
      'pg_untrack_logical_model',
      'pg_track_logical_model',
      'pg_create_logical_model_select_permission',
      'pg_create_logical_model_select_permission',
    ]);
    expect(steps.some((step) => step.type.includes('native_query'))).toBe(
      false,
    );
  });
});
