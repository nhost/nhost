import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ExportMetadataResponse,
  RemoteSchemaInfo,
} from '@/utils/hasura-api/generated/schemas';

export interface GetRemoteSchemasOptions {
  appUrl: string;
  adminSecret: string;
}

export interface GetRemoteSchemasVariables {
  // args: AddRemoteSchemaArgs;
}

/**
 * Type guard to validate if an object is a valid RemoteSchemaInfo
 */
function isRemoteSchemaInfo(obj: unknown): obj is RemoteSchemaInfo {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const schema = obj as Record<string, unknown>;

  // Check required fields
  if (typeof schema.name !== 'string') {
    return false;
  }

  if (!schema.definition || typeof schema.definition !== 'object') {
    return false;
  }

  const definition = schema.definition as Record<string, unknown>;

  // Check required definition fields
  if (typeof definition.url !== 'string') {
    return false;
  }

  // Check optional fields if they exist
  if (schema.comment !== undefined && typeof schema.comment !== 'string') {
    return false;
  }

  if (
    definition.timeout_seconds !== undefined &&
    typeof definition.timeout_seconds !== 'number'
  ) {
    return false;
  }

  return true;
}

export default async function getRemoteSchemas({
  appUrl,
  adminSecret,
}: GetRemoteSchemasOptions & GetRemoteSchemasVariables): Promise<
  RemoteSchemaInfo[]
> {
  try {
    const response = await metadataOperation(
      {
        type: 'export_metadata',
        version: 2,
        // args empty object {}
      },
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      const data = response.data as ExportMetadataResponse;

      // Extract remote schemas from the metadata
      const remoteSchemas = data.metadata?.remote_schemas || [];

      // Filter and validate remote schemas using the type guard
      const validRemoteSchemas = remoteSchemas.filter(isRemoteSchemaInfo);

      return validRemoteSchemas;
    }

    throw new Error(response.data.message);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
