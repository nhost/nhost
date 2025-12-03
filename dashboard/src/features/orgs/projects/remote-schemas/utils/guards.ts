import type {
  RemoteRelationshipDefinition,
  RemoteSchemaDefinition,
  RemoteSchemaDefinitionFromEnv,
  RemoteSchemaDefinitionFromUrl,
  ToRemoteSchemaRelationshipDefinition,
  ToSourceRelationshipDefinition,
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

export function isToRemoteSchemaRelationshipDefinition(
  definition: RemoteRelationshipDefinition,
): definition is { to_remote_schema: ToRemoteSchemaRelationshipDefinition } {
  return 'to_remote_schema' in definition && !('to_source' in definition);
}

export function isToSourceRelationshipDefinition(
  definition: RemoteRelationshipDefinition,
): definition is { to_source: ToSourceRelationshipDefinition } {
  return 'to_source' in definition && !('to_remote_schema' in definition);
}
