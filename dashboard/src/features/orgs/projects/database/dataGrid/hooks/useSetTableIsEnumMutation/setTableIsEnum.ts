import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { SetTableIsEnumArgs } from '@/utils/hasura-api/generated/schemas';

export interface SetTableIsEnumVariables {
  resourceVersion: number;
  args: SetTableIsEnumArgs;
}

export default async function setTableIsEnum({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & SetTableIsEnumVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: 'default',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_set_table_is_enum',
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
