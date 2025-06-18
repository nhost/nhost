import type {
  RemoteSchemaHeaderWithEnv,
  RemoteSchemaHeaderWithValue,
  RemoteSchemaInfo,
  RemoteSchemaInfoDefinitionHeadersItem,
} from '@/utils/hasura-api/generated/schemas';

export function isHeaderWithEnvValue(
  header: RemoteSchemaInfoDefinitionHeadersItem,
): header is RemoteSchemaHeaderWithEnv {
  return 'value_from_env' in header && !('value' in header);
}

export function isHeaderWithValue(
  header: RemoteSchemaInfoDefinitionHeadersItem,
): header is RemoteSchemaHeaderWithValue {
  return !('value_from_env' in header) && 'value' in header;
}

/**
 * Type guard to validate if an object is a valid RemoteSchemaInfo
 */
export function isRemoteSchemaInfo(obj: unknown): obj is RemoteSchemaInfo {
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

  // Check that either url or url_from_env is present (but not both)
  const hasUrl = typeof definition.url === 'string';
  const hasUrlFromEnv = typeof definition.url_from_env === 'string';

  if (!hasUrl && !hasUrlFromEnv) {
    // Neither url nor url_from_env is present
    return false;
  }

  if (hasUrl && hasUrlFromEnv) {
    // Both url and url_from_env are present (not allowed)
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
