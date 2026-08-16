import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelMutationType = 'add' | 'edit' | 'delete';

export interface LogicalModelMutationVariablesMap {
  add: { args: TrackLogicalModelArgs };
  edit: { args: TrackLogicalModelArgs; original: LogicalModelItem };
  delete: { original: LogicalModelItem };
}

export type LogicalModelMutationVariables<T extends LogicalModelMutationType> =
  LogicalModelMutationVariablesMap[T];
