import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { UpdateRemoteSchemaArgs } from '@/utils/hasura-api/generated/schemas';

export interface UpdateRemoteSchemaOptions {
  appUrl: string;
  adminSecret: string;
}

export interface UpdateRemoteSchemaVariables {
  args: UpdateRemoteSchemaArgs;
}

export default async function updateRemoteSchema({
  appUrl,
  adminSecret,
  args,
}: UpdateRemoteSchemaOptions & UpdateRemoteSchemaVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'update_remote_schema',
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

    throw new Error(response.data.message);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
