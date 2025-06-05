import { useSecurityKeysQuery } from '@/utils/__generated__/graphql';
import { useUserId } from '@nhost/nextjs';

function useGetSecurityKeys() {
  const currentUserId = useUserId();
  const query = useSecurityKeysQuery({
    variables: {
      userId: currentUserId,
    },
  });

  return query;
}

export default useGetSecurityKeys;
