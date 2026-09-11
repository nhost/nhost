import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelMutationType = 'add' | 'edit' | 'delete';

export type LogicalModelMutationArgs = Omit<TrackLogicalModelArgs, 'source'>;

export interface LogicalModelMutationVariablesMap {
  add: { source: string; args: LogicalModelMutationArgs };
  edit: {
    source: string;
    args: LogicalModelMutationArgs;
    original: LogicalModelItem;
  };
  delete: { source: string; original: LogicalModelItem };
}

export type LogicalModelMutationVariables<T extends LogicalModelMutationType> =
  LogicalModelMutationVariablesMap[T];
