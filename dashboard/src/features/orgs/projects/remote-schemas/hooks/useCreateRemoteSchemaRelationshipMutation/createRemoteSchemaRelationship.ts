import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { CreateRemoteSchemaRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export interface CreateRemoteSchemaRelationshipOptions {
  appUrl: string;
  adminSecret: string;
}

export interface CreateRemoteSchemaRelationshipVariables {
  args: CreateRemoteSchemaRemoteRelationshipArgs;
}

export default async function createRemoteSchemaRelationship({
  appUrl,
  adminSecret,
  args,
}: CreateRemoteSchemaRelationshipOptions &
  CreateRemoteSchemaRelationshipVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'create_remote_schema_remote_relationship',
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
