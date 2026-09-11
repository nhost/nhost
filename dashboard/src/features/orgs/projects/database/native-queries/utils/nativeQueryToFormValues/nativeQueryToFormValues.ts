import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

export default function nativeQueryToFormValues(
  query: NativeQueryItem,
  source: string,
): NativeQueryFormValues {
  return {
    source,
    rootFieldName: query.root_field_name,
    description: query.description ?? '',
    returns: query.returns,
    code: query.code,
    arguments: Object.entries(query.arguments ?? {}).map(
      ([name, argument]) => ({
        name,
        type: argument.type,
        nullable: argument.nullable ?? false,
        description: argument.description ?? '',
      }),
    ),
  };
}
