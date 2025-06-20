import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { ToSourceDefinition } from '@/utils/hasura-api/generated/schemas';

export interface CreateDatabaseRelationshipOptions {
  appUrl: string;
  adminSecret: string;
}

export interface CreateDatabaseRelationshipVariables {
  args: {
    remote_schema: string;
    type_name: string;
    name: string;
    definition: {
      to_source: ToSourceDefinition;
    };
  };
}

export default async function createDatabaseRelationship({
  appUrl,
  adminSecret,
  args,
}: CreateDatabaseRelationshipOptions & CreateDatabaseRelationshipVariables) {
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
