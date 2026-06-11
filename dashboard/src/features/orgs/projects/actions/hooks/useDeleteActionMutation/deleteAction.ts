import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { DropActionOperation } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteActionVariables {
  /**
   * Name of the action to delete.
   */
  actionName: string;
}

export default async function deleteAction({
  appUrl,
  adminSecret,
  actionName,
}: MetadataOperationOptions & DeleteActionVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'drop_action',
        args: {
          name: actionName,
        },
      } satisfies DropActionOperation,
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
