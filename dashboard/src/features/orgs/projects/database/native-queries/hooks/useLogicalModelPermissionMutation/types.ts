import type {
  CreateLogicalModelSelectPermissionArgs,
  LogicalModelSelectPermission,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelPermissionMutationType = 'add' | 'edit' | 'delete';

export interface LogicalModelPermissionMutationVariablesMap {
  add: { args: CreateLogicalModelSelectPermissionArgs };
  edit: {
    args: CreateLogicalModelSelectPermissionArgs;
    original: LogicalModelSelectPermission;
  };
  delete: {
    name: string;
    role: string;
    original: LogicalModelSelectPermission;
  };
}

export type LogicalModelPermissionMutationVariables<
  T extends LogicalModelPermissionMutationType,
> = LogicalModelPermissionMutationVariablesMap[T];
