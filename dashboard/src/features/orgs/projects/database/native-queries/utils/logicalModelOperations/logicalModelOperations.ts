import type {
  CreateLogicalModelSelectPermissionStep,
  LogicalModelItem,
  NativeQueryMetadataBulkOperation,
  TrackLogicalModelArgs,
  TrackLogicalModelStep,
  UntrackLogicalModelStep,
} from '@/utils/hasura-api/generated/schemas';

export const toTrackLogicalModelArgs = (
  model: LogicalModelItem,
): TrackLogicalModelArgs => ({
  source: 'default',
  name: model.name,
  fields: model.fields,
  ...(model.description === undefined
    ? {}
    : { description: model.description }),
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

export const buildEditLogicalModelSteps = (
  args: TrackLogicalModelArgs,
  original: LogicalModelItem,
): NativeQueryMetadataBulkOperation['args'] => [
  buildUntrackStep(original.name),
  buildTrackStep(args),
  ...buildPermissionSteps({ ...original, name: args.name }),
];
