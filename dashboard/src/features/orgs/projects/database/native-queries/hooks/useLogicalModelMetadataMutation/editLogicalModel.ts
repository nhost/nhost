import type { LogicalModelMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/types';
import type {
  CreateLogicalModelSelectPermissionStep,
  LogicalModelItem,
} from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface EditLogicalModelVariables {
  resourceVersion: number;
  source: string;
  args: LogicalModelMutationArgs;
  original: LogicalModelItem;
}

export default async function editLogicalModel({
  appUrl,
  adminSecret,
  resourceVersion,
  source,
  args,
  original,
}: MetadataOperationOptions & EditLogicalModelVariables) {
  const renamedPermissionSteps = (original.select_permissions ?? []).map(
    (permission) =>
      ({
        type: 'pg_create_logical_model_select_permission',
        args: { ...permission, name: args.name, source },
      }) satisfies CreateLogicalModelSelectPermissionStep,
  );

  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        resource_version: resourceVersion,
        args: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_untrack_logical_model',
                args: { source, name: original.name },
              },
              {
                type: 'pg_track_logical_model',
                args: { ...args, source },
              },
            ],
          },
          ...renamedPermissionSteps,
        ],
      },
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
