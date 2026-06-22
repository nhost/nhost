import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  AddComputedFieldArgs,
  ComputedFieldItem,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface EditComputedFieldVariables {
  resourceVersion: number;
  args: AddComputedFieldArgs;
  original: ComputedFieldItem;
}

export default async function editComputedField({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
  original,
}: MetadataOperationOptions & EditComputedFieldVariables) {
  const source = args.source ?? 'default';
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source,
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_drop_computed_field',
            args: {
              table: args.table,
              name: original.name,
              source,
              cascade: true,
            },
          },
          {
            type: 'pg_add_computed_field',
            args,
          },
        ],
      },
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
