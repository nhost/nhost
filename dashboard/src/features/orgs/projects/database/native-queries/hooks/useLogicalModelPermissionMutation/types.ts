import type { CreateLogicalModelSelectPermissionArgs } from '@/utils/hasura-api/generated/schemas';

export type LogicalModelPermissionMutationType = 'add' | 'edit' | 'delete';

export interface LogicalModelPermissionMutationVariablesMap {
  add: { args: CreateLogicalModelSelectPermissionArgs };
  edit: { args: CreateLogicalModelSelectPermissionArgs };
  delete: { name: string; role: string };
}

export type LogicalModelPermissionMutationVariables<
  T extends LogicalModelPermissionMutationType,
> = LogicalModelPermissionMutationVariablesMap[T];
