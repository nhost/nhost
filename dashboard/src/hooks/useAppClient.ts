import { useCurrentWorkspaceAndProject } from '@/features/projects/hooks/useCurrentWorkspaceAndProject';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl/generateAppServiceUrl';
import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getStorageServiceUrl,
} from '@/utils/env';
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

  const authUrl = generateAppServiceUrl(
    currentProject.subdomain,
    currentProject.region,
    'auth',
  );
  const graphqlUrl = generateAppServiceUrl(
    currentProject.subdomain,
    currentProject.region,
    'graphql',
  );
  const storageUrl = generateAppServiceUrl(
    currentProject.subdomain,
    currentProject.region,
    'storage',
  );
  const functionsUrl = generateAppServiceUrl(
    currentProject.subdomain,
    currentProject.region,
    'functions',
  );

  return new NhostClient({
    authUrl,
    graphqlUrl,
    storageUrl,
    functionsUrl,
    ...options,
  });
}

export default useAppClient;
