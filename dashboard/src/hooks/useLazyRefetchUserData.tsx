import { useApolloClient } from '@apollo/client';

export function useLazyRefetchUserData() {
  const client = useApolloClient();

  const refetchUserData = async () => {
    await client.refetchQueries({
      include: ['getOneUser'],
    });
  };

  return { refetchUserData };
}

export default useLazyRefetchUserData;
