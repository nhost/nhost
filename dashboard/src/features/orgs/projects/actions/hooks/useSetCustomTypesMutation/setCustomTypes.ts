import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ActionsBulkOperation,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface SetCustomTypesVariables {
  /**
   * The full set of custom types to persist. `set_custom_types` replaces the
   * whole custom types object, so callers must pass the complete set.
   */
  customTypes: CustomTypes;
}

export default async function setCustomTypes({
  appUrl,
  adminSecret,
  customTypes,
}: MetadataOperationOptions & SetCustomTypesVariables) {
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
