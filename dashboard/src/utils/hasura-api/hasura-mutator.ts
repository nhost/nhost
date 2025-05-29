import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type { ProjectFragment } from '@/utils/__generated__/graphql';
import { getHasuraAdminSecret } from '@/utils/env';

export interface HasuraMutatorContext {
  projectSubdomain?: string;
  projectRegion?: ProjectFragment['region'];
  adminSecret?: string;
  appUrl?: string;
}

export const hasuraMutator = async <T>(
  config: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    params?: any;
    data?: any;
    headers?: Record<string, string>;
  },
  options?: RequestInit & {
    // Add explicit context parameter for more idiomatic usage
    hasuraContext?: HasuraMutatorContext;
  },
): Promise<T> => {
  const { url, method, data, headers = {} } = config;

  // Use explicit context if provided, otherwise fall back to global context
  const context = options?.hasuraContext;

  // Build the full URL
  let baseUrl = context.appUrl;
  if (!baseUrl && context.projectSubdomain && context.projectRegion) {
    baseUrl = generateAppServiceUrl(
      context.projectSubdomain,
      context.projectRegion,
      'hasura',
    );
  }

  const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

  // Get admin secret
  const adminSecret =
    process.env.NEXT_PUBLIC_ENV === 'dev'
      ? getHasuraAdminSecret()
      : context.adminSecret;

  const response = await fetch(fullUrl, {
    ...options,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret && { 'x-hasura-admin-secret': adminSecret }),
      ...headers,
      ...options?.headers,
    },
    ...(data && { body: JSON.stringify(data) }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseData)}`);
  }

  return responseData;
};

/**
 * More idiomatic helper that builds context from project data
 * Similar to the pattern used in useCreateTableMutation.ts
 */
export const createHasuraContext = (
  project?: ProjectFragment | null,
): HasuraMutatorContext => ({
  projectSubdomain: project?.subdomain,
  projectRegion: project?.region,
  adminSecret:
    process.env.NEXT_PUBLIC_ENV === 'dev'
      ? getHasuraAdminSecret()
      : project?.config?.hasura.adminSecret,
  appUrl:
    process.env.NEXT_PUBLIC_ENV === 'dev'
      ? 'https://local.hasura.local.nhost.run'
      : undefined,
});
