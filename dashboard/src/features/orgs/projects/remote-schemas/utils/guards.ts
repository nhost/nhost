import type {
  HeadersItem,
  HeaderWithEnv,
  HeaderWithValue,
  RemoteSchemaDefinition,
  RemoteSchemaDefinitionFromEnv,
  RemoteSchemaDefinitionFromUrl,
  RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItemDefinition,
  ToRemoteSchemaRelationshipDefinition,
  ToSourceRelationshipDefinition,
} from '@/utils/hasura-api/generated/schemas';

export function isHeaderWithEnvValue(
  header: HeadersItem,
): header is HeaderWithEnv {
  return 'value_from_env' in header && !('value' in header);
}

export function isHeaderWithValue(
  header: HeadersItem,
): header is HeaderWithValue {
  return !('value_from_env' in header) && 'value' in header;
}

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
  definition: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItemDefinition,
): definition is { to_remote_schema: ToRemoteSchemaRelationshipDefinition } {
  return 'to_remote_schema' in definition && !('to_source' in definition);
}

export function isToSourceRelationshipDefinition(
  definition: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItemDefinition,
): definition is { to_source: ToSourceRelationshipDefinition } {
  return 'to_source' in definition && !('to_remote_schema' in definition);
}

/**
 * Type guard to validate if an object is a ToRemoteSchemaDefinition or a ToSourceDefinition
 */
export function isToRemoteSchemaDefinition(
  definition: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItemDefinition,
): definition is { to_remote_schema: ToRemoteSchemaDefinition } {
  return 'to_remote_schema' in definition && !('to_source' in definition);
}

export function isToSourceDefinition(
  definition: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItemDefinition,
): definition is { to_source: ToSourceDefinition } {
  return 'to_source' in definition && !('to_remote_schema' in definition);
}
