import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  IntrospectRemoteSchemaArgs,
  IntrospectRemoteSchemaOperation,
  IntrospectRemoteSchemaResponse,
} from '@/utils/hasura-api/generated/schemas';

export interface IntrospectRemoteSchemaVariables {
  args: IntrospectRemoteSchemaArgs;
}

export default async function introspectRemoteSchema({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & IntrospectRemoteSchemaVariables) {
  try {
    const operation: IntrospectRemoteSchemaOperation = {
      type: 'introspect_remote_schema',
      args: {
        name: args.name,
      },
    };
    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as IntrospectRemoteSchemaResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
