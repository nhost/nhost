import {
  classifyMetadataVersionConflictResponse,
  classifyMigrationMetadataVersionConflictResponse,
  MetadataVersionConflictError,
} from '@/utils/hasura-api/metadata-version-conflict-error';

interface LegacyResponse {
  status: number;
}

export function throwIfMetadataVersionConflict(
  response: LegacyResponse,
  data: unknown,
  appUrl: string,
): void {
  const conflict = classifyMetadataVersionConflictResponse({
    status: response.status,
    data,
  });

  if (conflict) {
    throw new MetadataVersionConflictError(conflict.message, appUrl);
  }
}

export function throwIfMigrationMetadataVersionConflict(
  response: LegacyResponse,
  data: unknown,
  appUrl: string,
): void {
  const conflict = classifyMigrationMetadataVersionConflictResponse({
    status: response.status,
    data,
  });

  if (conflict) {
    throw new MetadataVersionConflictError(conflict.message, appUrl);
  }
}
