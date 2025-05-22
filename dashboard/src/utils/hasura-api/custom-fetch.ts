export const customFetch = async (
  url: string,
  options: RequestInit = {},
  appUrl?: string,
  adminSecret?: string,
): Promise<Response> => {
  // Allow overriding the base URL with appUrl parameter
  const baseUrl = appUrl || '';
  const fullUrl = `${baseUrl}${url}`;

  //   const appUrl = generateAppServiceUrl(
  //     project?.subdomain,
  //     project?.region,
  //     'hasura',
  //   );

  // Add auth header if provided
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (adminSecret) {
    headers['x-hasura-admin-secret'] = adminSecret;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  return fetch(fullUrl, config);
};
