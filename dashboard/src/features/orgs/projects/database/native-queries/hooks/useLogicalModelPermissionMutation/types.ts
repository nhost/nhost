import type { CreateLogicalModelSelectPermissionArgs } from '@/utils/hasura-api/generated/schemas';

export type LogicalModelPermissionArgs = Omit<
  CreateLogicalModelSelectPermissionArgs,
  'source'
>;

export type LogicalModelSelectPermission =
  CreateLogicalModelSelectPermissionArgs['permission'];

export type LogicalModelPermissionMutationType = 'add' | 'edit' | 'delete';

export interface LogicalModelPermissionMutationVariablesMap {
  add: { source: string; args: LogicalModelPermissionArgs };
  edit: {
    source: string;
    args: LogicalModelPermissionArgs;
    original: LogicalModelSelectPermission;
  };
  delete: {
    source: string;
    name: string;
    role: string;
    original: LogicalModelSelectPermission;
    originalComment?: string | null;
  };
}

export type LogicalModelPermissionMutationVariables<
  T extends LogicalModelPermissionMutationType,
> = LogicalModelPermissionMutationVariablesMap[T];
