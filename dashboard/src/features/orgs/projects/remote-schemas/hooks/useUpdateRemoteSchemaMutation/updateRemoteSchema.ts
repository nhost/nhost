import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  RemoteSchemaInfo,
  UpdateRemoteSchemaArgs,
} from '@/utils/hasura-api/generated/schemas';

export interface UpdateRemoteSchemaOptions {
  appUrl: string;
  adminSecret: string;
}

export interface UpdateRemoteSchemaVariables {
  originalRemoteSchema: RemoteSchemaInfo; // Original remote schema info is necessary to match the update migration variables type
  updatedRemoteSchema: UpdateRemoteSchemaArgs;
}

export default async function updateRemoteSchema({
  appUrl,
  adminSecret,
  updatedRemoteSchema,
}: UpdateRemoteSchemaOptions & UpdateRemoteSchemaVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'update_remote_schema',
        args: updatedRemoteSchema,
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
