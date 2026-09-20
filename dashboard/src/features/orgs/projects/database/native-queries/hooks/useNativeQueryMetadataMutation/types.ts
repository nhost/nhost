import type {
  NativeQueryItem,
  TrackNativeQueryArgs,
} from '@/utils/hasura-api/generated/schemas';

export type NativeQueryMutationType = 'add' | 'edit' | 'delete';

export type NativeQueryMutationArgs = Omit<TrackNativeQueryArgs, 'source'>;

export interface NativeQueryMutationVariablesMap {
  add: { resourceVersion: number; args: NativeQueryMutationArgs };
  edit: {
    resourceVersion: number;
    args: NativeQueryMutationArgs;
    original: NativeQueryItem;
  };
  delete: { resourceVersion: number; original: NativeQueryItem };
}

export type NativeQueryMutationVariables<T extends NativeQueryMutationType> =
  NativeQueryMutationVariablesMap[T];
