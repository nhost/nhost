import { normalizeMetadataError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeMetadataError';
import type { EnvOrValueHeader } from '@/features/orgs/projects/remote-schemas/types';
import type { MutationOrQueryBaseOptions } from '@/features/orgs/projects/remote-schemas/types/remoteSchemas';

export interface CreateRemoteSchemaVariables {
  /**
   * Comment of the remote schema.
   */
  comment: string;
  /**
   * Definition of the remote schema.
   */
  definition: {
    customization: {};
    forward_client_headers: boolean;
    headers: EnvOrValueHeader[];
    timeout_seconds: number;
    url: string;
  };
  /**
   * Name of the remote schema to create.
   */
  name: string;
}

export interface CreateRemoteSchemaOptions
  extends Omit<MutationOrQueryBaseOptions, 'name'> {}

export default async function createRemoteSchema({
  appUrl,
  adminSecret,
  name,
  comment,
  definition,
}: CreateRemoteSchemaOptions & CreateRemoteSchemaVariables) {
  const response = await fetch(`${appUrl}/v1/metadata`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: {
        name,
        comment,
        definition,
      },
      type: 'add_remote_schema',
    }),
  });

  const responseData = await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeMetadataError(responseData);

  throw new Error(normalizedError);
}
