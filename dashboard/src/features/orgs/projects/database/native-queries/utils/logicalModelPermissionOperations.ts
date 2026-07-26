import type {
  CreateLogicalModelSelectPermissionArgs,
  CreateLogicalModelSelectPermissionStep,
  DropLogicalModelSelectPermissionStep,
  LogicalModelSelectPermission,
  NativeQueryMetadataBulkOperation,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelPermissionStep =
  NativeQueryMetadataBulkOperation['args'][number];

export interface LogicalModelPermissionMigration {
  name: string;
  up: LogicalModelPermissionStep[];
  down: LogicalModelPermissionStep[];
  datasource: 'default';
  skip_execution: false;
}

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

export const buildCreateLogicalModelPermissionMigration = (
  args: CreateLogicalModelSelectPermissionArgs,
): LogicalModelPermissionMigration => ({
  name: `create_logical_model_select_permission_${args.name}_${args.role}`,
  up: [buildCreateLogicalModelPermissionStep(args)],
  down: [buildDropLogicalModelPermissionStep(args.name, args.role)],
  datasource: 'default',
  skip_execution: false,
});

export const buildEditLogicalModelPermissionSteps = (
  args: CreateLogicalModelSelectPermissionArgs,
): LogicalModelPermissionStep[] => [
  buildDropLogicalModelPermissionStep(args.name, args.role),
  buildCreateLogicalModelPermissionStep(args),
];

export const buildEditLogicalModelPermissionMigration = (
  args: CreateLogicalModelSelectPermissionArgs,
  original: LogicalModelSelectPermission,
): LogicalModelPermissionMigration => ({
  name: `update_logical_model_select_permission_${args.name}_${args.role}`,
  up: buildEditLogicalModelPermissionSteps(args),
  down: [
    buildDropLogicalModelPermissionStep(args.name, args.role),
    buildCreateLogicalModelPermissionStep({
      source: 'default',
      name: args.name,
      role: args.role,
      permission: original,
    }),
  ],
  datasource: 'default',
  skip_execution: false,
});

export const buildDeleteLogicalModelPermissionMigration = (
  name: string,
  role: string,
  original: LogicalModelSelectPermission,
): LogicalModelPermissionMigration => ({
  name: `delete_logical_model_select_permission_${name}_${role}`,
  up: [buildDropLogicalModelPermissionStep(name, role)],
  down: [
    buildCreateLogicalModelPermissionStep({
      source: 'default',
      name,
      role,
      permission: original,
    }),
  ],
  datasource: 'default',
  skip_execution: false,
});
