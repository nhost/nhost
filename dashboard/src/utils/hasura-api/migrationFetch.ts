import { getHasuraMigrationsApiUrl, isPlatform } from '@/utils/env';
import { customFetch } from '@/utils/hasura-api/customFetch';
import type { CustomFetchOptions } from '@/utils/hasura-api/customFetch';

export function migrationFetch<T>(
  url: string,
  options?: CustomFetchOptions,
): Promise<T> {
  if (isPlatform()) {
    return customFetch<T>(url, options);
  }

  return customFetch<T>(getHasuraMigrationsApiUrl(), {
    ...options,
    baseUrl: undefined,
  });
}
