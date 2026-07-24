import { getHasuraMigrationsApiUrl, isPlatform } from '@/utils/env';

export interface CustomFetchOptions extends RequestInit {
  baseUrl?: string;
  adminSecret?: string;
}

const MIGRATIONS_API_PATH = '/apis/migrate';

function resolveUrl(url: string, baseUrl?: string): string {
  if (!isPlatform() && url === MIGRATIONS_API_PATH) {
    return getHasuraMigrationsApiUrl();
  }

  return baseUrl ? `${baseUrl}${url}` : url;
}

function parseResponseBody(body: string | null): unknown {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body) as unknown;
  } catch (error: unknown) {
    throw new Error('Failed to parse Hasura API response as JSON', {
      cause: error,
    });
  }
}

export async function customFetch<T>(
  url: string,
  options?: CustomFetchOptions,
): Promise<T> {
  const { baseUrl, adminSecret, ...fetchOptions } = options || {};
  const finalUrl = resolveUrl(url, baseUrl);

  const response = await fetch(finalUrl, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret ? { 'x-hasura-admin-secret': adminSecret } : {}),
      ...(fetchOptions.headers || {}),
    },
  });

  const body = [204, 205, 304].includes(response.status)
    ? null
    : await response.text();
  const data = parseResponseBody(body);

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
}
