import type {
  NativeQueryItem,
  TrackNativeQueryArgs,
} from '@/utils/hasura-api/generated/schemas';

export interface NativeQueryArgumentFormValue {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

export interface NativeQueryFormValues {
  source: string;
  rootFieldName: string;
  description: string;
  returns: string;
  code: string;
  arguments: NativeQueryArgumentFormValue[];
}

export default function buildNativeQueryTrackArgs(
  values: NativeQueryFormValues,
  original?: NativeQueryItem,
): TrackNativeQueryArgs {
  const args = Object.fromEntries(
    values.arguments.map(({ name, type, nullable, description }) => {
      const normalizedDescription = description.trim();

      return [
        name,
        {
          type,
          nullable,
          ...(normalizedDescription
            ? { description: normalizedDescription }
            : {}),
        },
      ];
    }),
  );

  const preservedOriginal = { ...original };
  Reflect.deleteProperty(preservedOriginal, 'comment');
  const normalizedComment = values.description.trim();

  return {
    ...preservedOriginal,
    source: values.source,
    root_field_name: values.rootFieldName.trim(),
    type: 'query',
    arguments: args,
    code: values.code,
    returns: values.returns,
    ...(normalizedComment ? { comment: normalizedComment } : {}),
  };
}
