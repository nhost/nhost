import { useCurrentWorkspaceAndProject } from '@/features/projects/common/useCurrentWorkspaceAndProject';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getStorageServiceUrl,
} from '@/utils/env';
import { isDevOrStaging } from '@/utils/helpers';
import type { NhostNextClientConstructorParams } from '@nhost/nextjs';
import { NhostClient } from '@nhost/nextjs';

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
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  if (!isPlatform) {
    return new NhostClient({
      authUrl: getAuthServiceUrl(),
      graphqlUrl: getGraphqlServiceUrl(),
      storageUrl: getStorageServiceUrl(),
      functionsUrl: getFunctionsServiceUrl(),
      ...options,
    });
  }

  if (process.env.NEXT_PUBLIC_ENV === 'dev' || !currentProject) {
    return new NhostClient({
      subdomain: 'local',
      ...options,
    });
  }

  return new NhostClient({
    subdomain: currentProject.subdomain,
    region: isDevOrStaging()
      ? `${currentProject.region.awsName}.staging`
      : currentProject.region.awsName,
    ...options,
  });
}

export default useAppClient;
