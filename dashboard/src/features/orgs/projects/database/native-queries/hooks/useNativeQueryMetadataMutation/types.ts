import type {
  NativeQueryItem,
  TrackNativeQueryArgs,
} from '@/utils/hasura-api/generated/schemas';

export type NativeQueryMutationType = 'add' | 'edit' | 'delete';

export interface NativeQueryMutationVariablesMap {
  add: { args: TrackNativeQueryArgs };
  edit: { args: TrackNativeQueryArgs; original: NativeQueryItem };
  delete: { original: NativeQueryItem };
}

export type NativeQueryMutationVariables<T extends NativeQueryMutationType> =
  NativeQueryMutationVariablesMap[T];
