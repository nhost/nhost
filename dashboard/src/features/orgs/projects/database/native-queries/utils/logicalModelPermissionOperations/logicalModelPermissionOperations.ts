import type {
  CreateLogicalModelSelectPermissionArgs,
  CreateLogicalModelSelectPermissionStep,
  DropLogicalModelSelectPermissionStep,
  NativeQueryMetadataBulkOperation,
} from '@/utils/hasura-api/generated/schemas';

export const buildCreateLogicalModelPermissionStep = (
  args: CreateLogicalModelSelectPermissionArgs,
): CreateLogicalModelSelectPermissionStep => ({
  type: 'pg_create_logical_model_select_permission',
  args: { ...args, source: 'default' },
});

export const buildDropLogicalModelPermissionStep = (
  name: string,
  role: string,
): DropLogicalModelSelectPermissionStep => ({
  type: 'pg_drop_logical_model_select_permission',
  args: { source: 'default', name, role },
});

export const buildEditLogicalModelPermissionSteps = (
  args: CreateLogicalModelSelectPermissionArgs,
): NativeQueryMetadataBulkOperation['args'] => [
  buildDropLogicalModelPermissionStep(args.name, args.role),
  buildCreateLogicalModelPermissionStep(args),
];
