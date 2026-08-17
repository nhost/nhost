import { getHasuraMetadataExportApiUrl } from '@/utils/env';
import type {
  ErrorResponse,
  ExportMetadataResponse,
} from '@/utils/hasura-api/generated/schemas';

export interface MetadataExportFetchOptions {
  adminSecret?: string;
}

export type MetadataExportErrorBody = ErrorResponse | string | null;

export interface ExportLocalMetadataResponse {
  data: ExportMetadataResponse;
  status: 200;
  headers: Headers;
}

export class MetadataExportError extends Error {
  readonly status: number;

  readonly body: MetadataExportErrorBody;

  constructor(status: number, body: MetadataExportErrorBody) {
    super(getMetadataExportErrorMessage(status, body));
    this.name = 'MetadataExportError';
    this.status = status;
    this.body = body;
  }
}

function getMetadataExportErrorMessage(
  status: number,
  body: MetadataExportErrorBody,
): string {
  if (body && typeof body === 'object') {
    const message = body.error || body.message;

    if (message) {
      return message;
    }
  }

  if (typeof body === 'string' && body) {
    return body;
  }

  return `Metadata export request failed with status ${status}`;
}

function parseErrorBody(rawBody: string): MetadataExportErrorBody {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as ErrorResponse;
  } catch {
    return rawBody;
  }
}

export async function exportLocalMetadata(
  options?: MetadataExportFetchOptions,
): Promise<ExportLocalMetadataResponse> {
  const { adminSecret } = options || {};
  const url = `${getHasuraMetadataExportApiUrl()}?export=true`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: adminSecret ? { 'x-hasura-admin-secret': adminSecret } : {},
    });
  } catch (error) {
    throw new Error('Failed to reach the metadata export API', {
      cause: error,
    });
  }

  const rawBody = await response.text();

  if (response.status !== 200) {
    throw new MetadataExportError(response.status, parseErrorBody(rawBody));
  }

  let data: ExportMetadataResponse;

  try {
    data = JSON.parse(rawBody) as ExportMetadataResponse;
  } catch (error) {
    throw new Error('Failed to parse the metadata export response as JSON', {
      cause: error,
    });
  }

  return { data, status: 200, headers: response.headers };
}
