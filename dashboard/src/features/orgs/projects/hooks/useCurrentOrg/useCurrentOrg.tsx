import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAuth } from '@/providers/Auth';
import {
  useGetOrganizationQuery,
  type Exact,
  type GetOrganizationQuery,
} from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';

export type Org = GetOrganizationQuery['organizations'][0];

export interface UseCurrenOrgReturnType {
  org: Org;
  loading?: boolean;
  error: Error | null;
  refetch: (
    variables?: Partial<
      Exact<{
        orgSlug: string;
      }>
    >,
  ) => Promise<any>;
}

export default function useCurrentOrg(): UseCurrenOrgReturnType {
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const {
    query: { orgSlug },
    isReady: isRouterReady,
  } = useRouter();

  const isOrgSlugAvailable = Boolean(orgSlug);

  const shouldFetchOrg =
    isPlatform &&
    isRouterReady &&
    isOrgSlugAvailable &&
    isAuthenticated &&
    !isAuthLoading;

  const { data, loading, error, refetch } = useGetOrganizationQuery({
    fetchPolicy: 'cache-and-network',
    skip: !shouldFetchOrg,
    variables: {
      orgSlug: (orgSlug as string) ?? '',
    },
  });

  const {
    organizations: [org],
  } = data || { organizations: [] };
  return {
    org,
    loading: org ? false : loading || isAuthLoading,
    error: error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
    refetch,
  };
}
