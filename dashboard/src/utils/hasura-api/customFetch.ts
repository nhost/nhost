export interface CustomFetchOptions extends RequestInit {
  baseUrl?: string;
  adminSecret?: string;
}

export async function customFetch<T>(
  url: string,
  options?: CustomFetchOptions,
): Promise<T> {
  const { baseUrl, adminSecret, ...fetchOptions } = options || {};

  // If baseUrl is provided, use it; otherwise use the relative URL as-is
  const finalUrl = baseUrl ? `${baseUrl}${url}` : url;

  const response = await fetch(finalUrl, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
      ...fetchOptions.headers,
    },
  });

  const body = [204, 205, 304].includes(response.status)
    ? null
    : await response.text();
  const data = body ? JSON.parse(body) : {};

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
}
