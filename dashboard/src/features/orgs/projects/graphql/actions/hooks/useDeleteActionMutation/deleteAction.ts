import type {
  ActionItem,
  DropActionOperation,
} from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteActionVariables {
  /**
   * The action to delete. The full item is required so the local migration path
   * can recreate it in the down migration.
   */
  action: ActionItem;
}

export default async function deleteAction({
  appUrl,
  adminSecret,
  action,
}: MetadataOperationOptions & DeleteActionVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'drop_action',
        args: {
          name: action.name,
        },
      } satisfies DropActionOperation,
      {
        appUrl,
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
