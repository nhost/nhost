import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateActionPermissionStep,
  DropActionPermissionStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export type ManageActionPermissionType =
  | 'create_action_permission'
  | 'drop_action_permission';

export interface ManageActionPermissionVariables {
  /**
   * Name of the action whose permission is being changed.
   */
  action: string;
  /**
   * Name of the role being granted or revoked.
   */
  role: string;
  /**
   * Whether to grant or remove the permission.
   */
  type: ManageActionPermissionType;
}

export function buildStep({
  action,
  role,
  type,
}: ManageActionPermissionVariables):
  | CreateActionPermissionStep
  | DropActionPermissionStep {
  if (type === 'create_action_permission') {
    return {
      type,
      args: {
        action,
        role,
        definition: {
          select: {
            filter: {},
          },
        },
      },
    };
  }

  return {
    type,
    args: {
      action,
      role,
    },
  };
}

export default async function manageActionPermission({
  appUrl,
  adminSecret,
  action,
  role,
  type,
}: MetadataOperationOptions & ManageActionPermissionVariables) {
  try {
    const response = await metadataOperation(
      buildStep({ action, role, type }),
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
