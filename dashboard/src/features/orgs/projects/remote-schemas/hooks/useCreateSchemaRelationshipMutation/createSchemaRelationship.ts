import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { CreateRemoteSchemaRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export interface CreateSchemaRelationshipOptions {
  appUrl: string;
  adminSecret: string;
}

export interface CreateSchemaRelationshipVariables {
  args: CreateRemoteSchemaRemoteRelationshipArgs;
}

export default async function createSchemaRelationship({
  appUrl,
  adminSecret,
  args,
}: CreateSchemaRelationshipOptions & CreateSchemaRelationshipVariables) {
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

    throw new Error(response.data.message);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
