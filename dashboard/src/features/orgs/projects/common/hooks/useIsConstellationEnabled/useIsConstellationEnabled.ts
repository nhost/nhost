import { gql, useQuery } from '@apollo/client';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ConfigConfig } from '@/generated/graphql';

const GET_CONFIG_CONSTELLATION = gql`
  query getConfigConstellation($appId: uuid!) {
    config(appID: $appId, resolve: true) {
      experimental {
        constellation {
          version
        }
      }
    }
  }
`;

type GetConfigConstellationQuery = {
  config?: Pick<ConfigConfig, 'experimental'> | null;
};

/**
 * Returns `true` when the local project runs with the experimental
 * Constellation engine enabled.
 *
 * Constellation replaces Hasura as the GraphQL engine and does not serve the
 * hasura-cli migrations API (`/apis/migrate`). Callers use this to route
 * schema/metadata mutations through the query and metadata APIs
 * (`/v2/query`, `/v1/metadata`) instead — the same path the cloud platform
 * already uses, where there is no hasura-cli console either.
 *
 * On the platform the query is skipped: `isPlatform` already selects the
 * direct API path, so the value is unused there.
 *
 * While the config query is in flight, `isConstellationEnabled` is `undefined`
 * rather than `false`, so callers cannot treat "not yet known" as "disabled"
 * and mis-route an early mutation to the non-existent hasura-cli migrations
 * API. The migration branch must only be taken once the value is definitively
 * `false` (i.e. `isConstellationEnabled === false`).
 */
export default function useIsConstellationEnabled(): {
  isConstellationEnabled: boolean | undefined;
  loading: boolean;
} {
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const localMimirClient = useLocalMimirClient();

  const { data, loading } = useQuery<GetConfigConstellationQuery>(
    GET_CONFIG_CONSTELLATION,
    {
      variables: { appId: project?.id },
      skip: isPlatform || !project,
      client: localMimirClient,
    },
  );

  return {
    isConstellationEnabled: loading
      ? undefined
      : Boolean(data?.config?.experimental?.constellation),
    loading,
  };
}
