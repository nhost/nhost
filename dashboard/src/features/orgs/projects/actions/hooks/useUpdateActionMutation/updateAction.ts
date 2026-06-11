import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ActionsBulkOperation,
  CreateActionArgs,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface UpdateActionVariables {
  args: CreateActionArgs;
  customTypes: CustomTypes;
}

export default async function updateAction({
  appUrl,
  adminSecret,
  args,
  customTypes,
}: MetadataOperationOptions & UpdateActionVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        args: [
          {
            type: 'set_custom_types',
            args: customTypes,
          },
          {
            type: 'update_action',
            args,
          },
        ],
      } satisfies ActionsBulkOperation,
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
