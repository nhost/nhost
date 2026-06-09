import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { DropComputedFieldArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteComputedFieldVariables {
  resourceVersion: number;
  args: DropComputedFieldArgs;
}

export default async function deleteComputedField({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & DeleteComputedFieldVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_drop_computed_field',
            args: { cascade: true, ...args },
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
