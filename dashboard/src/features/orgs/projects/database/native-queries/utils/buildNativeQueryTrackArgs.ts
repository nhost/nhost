import type {
  NativeQueryItem,
  TrackNativeQueryArgs,
} from '@/utils/hasura-api/generated/schemas';

export interface NativeQueryArgumentFormValue {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export interface NativeQueryFormValues {
  source: string;
  rootFieldName: string;
  returns: string;
  code: string;
  arguments: NativeQueryArgumentFormValue[];
}

export default function buildNativeQueryTrackArgs(
  values: NativeQueryFormValues,
  original?: NativeQueryItem,
): TrackNativeQueryArgs {
  const args = Object.fromEntries(
    values.arguments.map(({ name, type, nullable, description }) => [
      name,
      {
        type,
        nullable,
        ...(description?.trim() ? { description: description.trim() } : {}),
      },
    ]),
  );

  return {
    ...original,
    source: values.source,
    root_field_name: values.rootFieldName.trim(),
    type: 'query',
    arguments: args,
    code: values.code,
    returns: values.returns,
  };
}
