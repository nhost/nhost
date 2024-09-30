import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useGetProjectQuery } from '@/utils/__generated__/graphql';
import { useAuthenticationStatus } from '@nhost/nextjs';
import { useRouter } from 'next/router';

export default function useProject({ poll = false }: { poll?: boolean } = {}) {
  const {
    query: { appSlug },
  } = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } =
    useAuthenticationStatus();

  const shouldFetchProject =
    isPlatform && isAuthenticated && !isAuthLoading && appSlug;

  const { data, loading, error, refetch } = useGetProjectQuery({
    variables: { slug: appSlug as string },
    skip: !shouldFetchProject,
    fetchPolicy: 'cache-and-network',
    pollInterval: poll ? 5000 : 0,
  });

  const project = data?.apps?.[0];

  return {
    project,
    loading: data ? false : loading || isAuthLoading,
    error: error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
    refetch,
  };
}
