import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useGetGraphiteSessionsQuery } from '@/generated/graphite';

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
