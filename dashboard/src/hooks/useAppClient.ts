import { LOCAL_SUBDOMAIN } from '@/utils/env';
import { isDevOrStaging } from '@/utils/helpers';
import type { NhostNextClientConstructorParams } from '@nhost/nextjs';
import { NhostClient } from '@nhost/nextjs';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

export type UseAppClientOptions = NhostNextClientConstructorParams;
export type UseAppClientReturn = NhostClient;

/**
 * This hook returns an application specific Nhost client instance that can be
 * used to interact with the client's backend.
 *
 * @param options - Client configuration options
 * @returns Application specific Nhost client instance
 */
export function useAppClient(
  options?: UseAppClientOptions,
): UseAppClientReturn {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  if (process.env.NEXT_PUBLIC_ENV === 'dev' || !currentApplication) {
    return new NhostClient({
      subdomain: LOCAL_SUBDOMAIN,
      ...options,
    });
  }

  return new NhostClient({
    subdomain: currentApplication.subdomain,
    region: isDevOrStaging()
      ? `${currentApplication.region.awsName}.staging`
      : currentApplication.region.awsName,
    ...options,
  });
}

export default useAppClient;
