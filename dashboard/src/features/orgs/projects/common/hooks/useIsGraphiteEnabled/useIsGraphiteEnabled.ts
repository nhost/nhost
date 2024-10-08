/* eslint-disable import/extensions */
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { useGetGraphiteSessionsQuery } from '@/utils/__generated__/graphite.graphql';

export default function useIsGraphiteEnabled() {
  const { adminClient } = useAdminApolloClient();

  const { error, loading } = useGetGraphiteSessionsQuery({
    client: adminClient,
  });

  return {
    isGraphiteEnabled: !error,
    loading,
  };
}
