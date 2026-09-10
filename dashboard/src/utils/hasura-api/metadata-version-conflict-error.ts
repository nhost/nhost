const METADATA_VERSION_CONFLICT_MESSAGE =
  /^metadata resource version referenced \(\d+\) did not match current version$/;
const MAX_MIGRATION_ERROR_MESSAGE_LENGTH = 2_048;

interface ResponseLike {
  data: unknown;
  status: number;
}

export interface MetadataVersionConflictOrigin {
  appUrl: string;
}

interface MetadataVersionConflictDetails {
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResponseLike(value: unknown): value is ResponseLike {
  return (
    isRecord(value) &&
    typeof value.status === 'number' &&
    Object.hasOwn(value, 'data')
  );
}

function classifyConflictData(
  data: unknown,
): MetadataVersionConflictDetails | null {
  if (!isRecord(data)) {
    return null;
  }

  const { code, error } = data;

  if (
    code !== 'conflict' ||
    typeof error !== 'string' ||
    !METADATA_VERSION_CONFLICT_MESSAGE.test(error)
  ) {
    return null;
  }

  return { message: error };
}

export function classifyMetadataVersionConflictResponse(
  response: unknown,
): MetadataVersionConflictDetails | null {
  if (!isResponseLike(response) || response.status !== 409) {
    return null;
  }

  return classifyConflictData(response.data);
}

export function classifyMigrationMetadataVersionConflictResponse(
  response: unknown,
): MetadataVersionConflictDetails | null {
  if (
    !isResponseLike(response) ||
    response.status !== 400 ||
    !isRecord(response.data) ||
    response.data.code !== 'data_api_error' ||
    typeof response.data.message !== 'string' ||
    response.data.message.length > MAX_MIGRATION_ERROR_MESSAGE_LENGTH
  ) {
    return null;
  }

  try {
    return classifyConflictData(JSON.parse(response.data.message) as unknown);
  } catch {
    return null;
  }
}

function createSafeOrigin(
  appUrl: unknown,
): Readonly<MetadataVersionConflictOrigin> | null {
  if (typeof appUrl !== 'string' || appUrl.trim() !== appUrl) {
    return null;
  }

  try {
    const url = new URL(appUrl);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return Object.freeze({ appUrl });
  } catch {
    return null;
  }
}

export class MetadataVersionConflictError extends Error {
  readonly origin: Readonly<MetadataVersionConflictOrigin> | null;

  constructor(message: string, appUrl: unknown) {
    super(message);
    this.name = 'MetadataVersionConflictError';
    this.origin = createSafeOrigin(appUrl);
  }
}

export function isMetadataVersionConflictError(
  error: unknown,
): error is MetadataVersionConflictError {
  return error instanceof MetadataVersionConflictError;
}
