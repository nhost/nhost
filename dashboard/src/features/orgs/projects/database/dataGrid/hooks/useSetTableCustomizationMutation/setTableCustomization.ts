import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { SetTableCustomizationArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface SetTableCustomizationVariables {
  resourceVersion: number;
  args: SetTableCustomizationArgs;
}

export default async function setTableCustomization({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & SetTableCustomizationVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: 'default',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_set_table_customization',
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
