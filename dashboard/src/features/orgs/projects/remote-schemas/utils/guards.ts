import type {
  RemoteSchemaDefinition,
  RemoteSchemaDefinitionFromEnv,
  RemoteSchemaDefinitionFromUrl,
} from '@/utils/hasura-api/generated/schemas';

export function isRemoteSchemaFromEnvDefinition(
  definition: RemoteSchemaDefinition,
): definition is RemoteSchemaDefinitionFromEnv {
  return 'url_from_env' in definition && !('url' in definition);
}

export function isRemoteSchemaFromUrlDefinition(
  definition: RemoteSchemaDefinition,
): definition is RemoteSchemaDefinitionFromUrl {
  return 'url' in definition && !('url_from_env' in definition);
}
