import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { UpdateRemoteSchemaRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export interface UpdateRemoteSchemaRelationshipOptions {
  appUrl: string;
  adminSecret: string;
}

export interface UpdateRemoteSchemaRelationshipVariables {
  args: UpdateRemoteSchemaRemoteRelationshipArgs;
}

export default async function updateRemoteSchemaRelationship({
  appUrl,
  adminSecret,
  args,
}: UpdateRemoteSchemaRelationshipOptions &
  UpdateRemoteSchemaRelationshipVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'update_remote_schema_remote_relationship',
        args: {
          remote_schema: args.remote_schema,
          type_name: args.type_name,
          name: args.name,
          definition: args.definition,
        },
      },
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
