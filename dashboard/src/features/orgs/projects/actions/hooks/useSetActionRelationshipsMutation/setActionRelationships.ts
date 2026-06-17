import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ActionsBulkOperation,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface SetActionRelationshipsVariables {
  /**
   * The full set of custom types to persist. Relationships live inside the
   * output object types, so the whole custom types object is replaced.
   */
  customTypes: CustomTypes;
}

export default async function setActionRelationships({
  appUrl,
  adminSecret,
  customTypes,
}: MetadataOperationOptions & SetActionRelationshipsVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        args: [
          {
            type: 'set_custom_types',
            args: customTypes,
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
