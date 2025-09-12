import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { AddRemoteSchemaArgs } from '@/utils/hasura-api/generated/schemas';

export interface CreateRemoteSchemaOptions {
  appUrl: string;
  adminSecret: string;
}

export interface CreateRemoteSchemaVariables {
  args: AddRemoteSchemaArgs;
}

export default async function createRemoteSchema({
  appUrl,
  adminSecret,
  args,
}: CreateRemoteSchemaOptions & CreateRemoteSchemaVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'add_remote_schema',
        args: {
          name: args.name,
          definition: args.definition,
          comment: args.comment,
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

    throw new Error(response.data?.message);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
