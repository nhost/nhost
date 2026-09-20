import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelMutationType = 'add' | 'edit' | 'delete';

export type LogicalModelMutationArgs = Omit<TrackLogicalModelArgs, 'source'>;

export interface LogicalModelMutationVariablesMap {
  add: { resourceVersion: number; args: LogicalModelMutationArgs };
  edit: {
    resourceVersion: number;
    args: LogicalModelMutationArgs;
    original: LogicalModelItem;
  };
  delete: { resourceVersion: number; original: LogicalModelItem };
}

export type LogicalModelMutationVariables<T extends LogicalModelMutationType> =
  LogicalModelMutationVariablesMap[T];
