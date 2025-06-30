import { useUserData } from '@/hooks/useUserData';
import { useSecurityKeysQuery } from '@/utils/__generated__/graphql';

function useGetSecurityKeys() {
  const user = useUserData();
  const query = useSecurityKeysQuery({
    variables: {
      userId: user?.id,
    },
  });

  return query;
}

export default useGetSecurityKeys;
