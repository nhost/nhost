import type { DeleteRemoteSchemaRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';

export interface DeleteRemoteSchemaRelationshipOptions {
  appUrl: string;
  adminSecret: string;
}

export interface DeleteRemoteSchemaRelationshipVariables {
  args: DeleteRemoteSchemaRemoteRelationshipArgs;
}

export default async function deleteRemoteSchemaRelationship({
  appUrl,
  adminSecret,
  args,
}: DeleteRemoteSchemaRelationshipOptions &
  DeleteRemoteSchemaRelationshipVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'delete_remote_schema_remote_relationship',
        args: {
          remote_schema: args.remote_schema,
          type_name: args.type_name,
          name: args.name,
        },
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
