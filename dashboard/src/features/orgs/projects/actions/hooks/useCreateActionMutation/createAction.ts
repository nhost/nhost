import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ActionsBulkOperation,
  CreateActionArgs,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateActionVariables {
  args: CreateActionArgs;
  customTypes: CustomTypes;
  /**
   * Custom types as they were before this action was added. Only used by the
   * local migration path to build the down migration that restores them.
   */
  previousCustomTypes: CustomTypes;
}

export default async function createAction({
  appUrl,
  adminSecret,
  args,
  customTypes,
}: MetadataOperationOptions & CreateActionVariables) {
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
            type: 'create_action',
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
