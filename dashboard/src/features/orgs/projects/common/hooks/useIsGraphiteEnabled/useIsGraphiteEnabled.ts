import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useGetGraphiteSessionsQuery } from '@/utils/__generated__/graphite.graphql';

export default function useIsGraphiteEnabled() {
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const { error, loading } = useGetGraphiteSessionsQuery({
    client: remoteProjectGQLClient,
  });

  return {
    isGraphiteEnabled: !error,
    loading,
  };
}
