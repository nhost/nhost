import { getHasuraMigrationsApiUrl } from '@/utils/env';
import type { CustomFetchOptions } from '@/utils/hasura-api/customFetch';
import { customFetch } from '@/utils/hasura-api/customFetch';

export function migrationFetch<T>(
  _url: string,
  options?: CustomFetchOptions,
): Promise<T> {
  return customFetch<T>(getHasuraMigrationsApiUrl(), options);
}
