import { useAdminApolloClient } from '@/features/projects/common/hooks/useAdminApolloClient';
import { useGetGraphiteSessionsQuery } from '@/utils/__generated__/graphite.graphql';

export default function useIsGraphiteEnabled() {
  const { adminClient } = useAdminApolloClient();

  const { error } = useGetGraphiteSessionsQuery({
    client: adminClient,
  });

  return {
    isGraphiteEnabled: !error,
  };
}
