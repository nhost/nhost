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

export interface NativeQueryDTO {
  source: string;
  args: Omit<TrackNativeQueryArgs, 'source'>;
}

export default function buildNativeQueryDTO(
  values: NativeQueryFormValues,
  original?: NativeQueryItem,
): NativeQueryDTO {
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
  Reflect.deleteProperty(preservedOriginal, 'description');
  const normalizedDescription = values.description.trim();

  return {
    source: values.source,
    args: {
      ...preservedOriginal,
      root_field_name: values.rootFieldName,
      type: 'query',
      arguments: args,
      code: values.code,
      returns: values.returns,
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
    },
  };
}
