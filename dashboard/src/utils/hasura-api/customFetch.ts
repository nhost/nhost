export interface CustomFetchOptions extends RequestInit {
  adminSecret?: string;
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
  const { adminSecret, ...fetchOptions } = options || {};

  const response = await fetch(url, {
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
