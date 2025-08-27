import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  getAuthServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getStorageServiceUrl,
} from '@/utils/env';
import { DummySessionStorage } from '@/utils/nhost';
import {
  createClient,
  type NhostClient,
  type NhostClientOptions,
} from '@nhost/nhost-js';

export type UseAppClientOptions = NhostClientOptions;
export type UseAppClientReturn = NhostClient;

const storage = new DummySessionStorage();
/**
 * This hook returns an application specific Nhost client instance that can be
 * used to interact with the client's backend.
 *
 * @param options - Client configuration options
 * @returns Application specific Nhost client instance
 */
export default function useAppClient(
  options?: UseAppClientOptions,
): UseAppClientReturn {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (!isPlatform) {
    return createClient({
      authUrl: getAuthServiceUrl(),
      graphqlUrl: getGraphqlServiceUrl(),
      storageUrl: getStorageServiceUrl(),
      functionsUrl: getFunctionsServiceUrl(),
      ...options,
    });
  }

  if (process.env.NEXT_PUBLIC_ENV === 'dev' || !project) {
    return createClient({
      subdomain: 'local',
      region: 'local',
      ...options,
    });
  }

  const authUrl = generateAppServiceUrl(
    project.subdomain,
    project.region,
    'auth',
  );
  const graphqlUrl = generateAppServiceUrl(
    project.subdomain,
    project.region,
    'graphql',
  );
  const storageUrl = generateAppServiceUrl(
    project.subdomain,
    project.region,
    'storage',
  );
  const functionsUrl = generateAppServiceUrl(
    project.subdomain,
    project.region,
    'functions',
  );

  return createClient({
    authUrl,
    graphqlUrl,
    storageUrl,
    functionsUrl,
    storage,
    ...options,
  });
}
