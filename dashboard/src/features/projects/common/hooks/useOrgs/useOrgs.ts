import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  useGetOrganizationsQuery,
  type Exact,
  type GetOrganizationsQuery,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus } from '@nhost/nextjs';

export type Org = GetOrganizationsQuery['organizations'][0];

export interface UseOrgsReturnType {
  orgs: Org[];
  loading?: boolean;
  error?: Error;
  refetch: (
    variables?: Partial<
      Exact<{
        [key: string]: never;
      }>
    >,
  ) => Promise<any>;
}

export default function useOrgs(): UseOrgsReturnType {
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } =
    useAuthenticationStatus();

  const shouldFetchOrg = isPlatform && isAuthenticated && !isAuthLoading;

  const { data, loading, error, refetch } = useGetOrganizationsQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-first',
    skip: !shouldFetchOrg,
  });

  return {
    orgs: data?.organizations || [],
    loading: data ? false : loading || isAuthLoading,
    error: error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
    refetch,
  };
}
