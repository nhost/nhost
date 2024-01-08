import { useAdminApolloClient } from '@/features/projects/common/hooks/useAdminApolloClient';
import { useGetGraphiteSessionsQuery } from '@/utils/__generated__/graphite.graphql';
import { useEffect, useState } from 'react';

export default function useIsGraphiteEnabled() {
  const { adminClient } = useAdminApolloClient();

  const [isGraphiteEnabled, setIsGraphiteEnabled] = useState(false);

  const { loading, error } = useGetGraphiteSessionsQuery({
    client: adminClient,
  });

  useEffect(() => {
    if (!loading && error) {
      setIsGraphiteEnabled(false);
    }
  }, [error, loading]);

  return {
    isGraphiteEnabled,
  };
}
