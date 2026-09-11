import type {
  NativeQueryItem,
  TrackNativeQueryArgs,
} from '@/utils/hasura-api/generated/schemas';

export type NativeQueryMutationType = 'add' | 'edit' | 'delete';

export type NativeQueryMutationArgs = Omit<TrackNativeQueryArgs, 'source'>;

export interface NativeQueryMutationVariablesMap {
  add: { source: string; args: NativeQueryMutationArgs };
  edit: {
    source: string;
    args: NativeQueryMutationArgs;
    original: NativeQueryItem;
  };
  delete: { source: string; original: NativeQueryItem };
}

export type NativeQueryMutationVariables<T extends NativeQueryMutationType> =
  NativeQueryMutationVariablesMap[T];
