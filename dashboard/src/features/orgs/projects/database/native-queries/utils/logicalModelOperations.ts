import type {
  CreateLogicalModelSelectPermissionStep,
  LogicalModelItem,
  NativeQueryMetadataBulkOperation,
  TrackLogicalModelArgs,
  TrackLogicalModelStep,
  UntrackLogicalModelStep,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelStep = NativeQueryMetadataBulkOperation['args'][number];

export const toTrackLogicalModelArgs = (
  model: LogicalModelItem,
): TrackLogicalModelArgs => ({
  source: 'default',
  name: model.name,
  fields: model.fields,
});

export const buildTrackStep = (
  args: TrackLogicalModelArgs,
): TrackLogicalModelStep => ({
  type: 'pg_track_logical_model',
  args: { ...args, source: 'default' },
});

export const buildUntrackStep = (name: string): UntrackLogicalModelStep => ({
  type: 'pg_untrack_logical_model',
  args: { source: 'default', name },
});

export const buildPermissionSteps = (
  model: LogicalModelItem,
): CreateLogicalModelSelectPermissionStep[] =>
  (model.select_permissions ?? []).map(({ role, permission }) => ({
    type: 'pg_create_logical_model_select_permission',
    args: {
      source: 'default',
      name: model.name,
      role,
      permission,
    },
  }));

export interface LogicalModelMigration {
  name: string;
  up: LogicalModelStep[];
  down: LogicalModelStep[];
  datasource: 'default';
  skip_execution: false;
}

export const buildCreateLogicalModelMigration = (
  args: TrackLogicalModelArgs,
): LogicalModelMigration => ({
  name: `create_logical_model_${args.name}`,
  up: [buildTrackStep(args)],
  down: [buildUntrackStep(args.name)],
  datasource: 'default',
  skip_execution: false,
});

export const buildEditLogicalModelSteps = (
  args: TrackLogicalModelArgs,
  original: LogicalModelItem,
): LogicalModelStep[] => [
  buildUntrackStep(original.name),
  buildTrackStep(args),
  ...buildPermissionSteps({ ...original, name: args.name }),
];

export const buildEditLogicalModelMigration = (
  args: TrackLogicalModelArgs,
  original: LogicalModelItem,
): LogicalModelMigration => ({
  name: `update_logical_model_${original.name}`,
  up: buildEditLogicalModelSteps(args, original),
  down: [
    ...buildPermissionSteps({ ...original, name: args.name })
      .map(({ args: permissionArgs }) => ({
        type: 'pg_drop_logical_model_select_permission' as const,
        args: {
          source: 'default' as const,
          name: args.name,
          role: permissionArgs.role,
        },
      }))
      .toReversed(),
    buildUntrackStep(args.name),
    buildTrackStep(toTrackLogicalModelArgs(original)),
    ...buildPermissionSteps(original),
  ],
  datasource: 'default',
  skip_execution: false,
});

export const buildDeleteLogicalModelMigration = (
  original: LogicalModelItem,
): LogicalModelMigration => ({
  name: `delete_logical_model_${original.name}`,
  up: [buildUntrackStep(original.name)],
  down: [
    buildTrackStep(toTrackLogicalModelArgs(original)),
    ...buildPermissionSteps(original),
  ],
  datasource: 'default',
  skip_execution: false,
});
