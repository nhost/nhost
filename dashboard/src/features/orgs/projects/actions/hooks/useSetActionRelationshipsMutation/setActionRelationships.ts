import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ActionsBulkOperation,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export type SetActionRelationshipsMode = 'save' | 'remove';

export interface SetActionRelationshipsVariables {
  /**
   * The full set of custom types to persist. Relationships live inside the
   * output object types, so the whole custom types object is replaced.
   */
  customTypes: CustomTypes;
  /**
   * Custom types as they were before this change. Only used by the local
   * migration path to build the down migration that restores them.
   */
  previousCustomTypes: CustomTypes;
  /**
   * Name of the relationship being changed. Only used by the local migration
   * path to name the migration.
   */
  relationshipName: string;
  /**
   * Name of the output object type the relationship lives on. Only used by the
   * local migration path to name the migration.
   */
  outputTypeName: string;
  /**
   * Whether the relationship is being saved (created/edited) or removed. Only
   * used by the local migration path to name the migration.
   */
  mode: SetActionRelationshipsMode;
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
