import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAuth } from '@/providers/Auth';
import {
  useGetOrganizationQuery,
  type Exact,
  type GetOrganizationQuery,
} from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';

import { useNhostClient } from '@/providers/nhost';
import { useQuery } from '@tanstack/react-query';

const query = `
    query getOrganization($orgSlug: String!) {
  organizations(where: {slug: {_eq: $orgSlug}}) {
    id
    name
    slug
    status
    plan {
      id
      name
      price
      deprecated
      individual
      isFree
      featureMaxDbSize
    }
    members {
      id
      role
      user {
        id
        email
        displayName
        avatarUrl
      }
    }
    apps(order_by: {name: asc}) {
      id
      name
      subdomain
      slug
    }
  }
}
    `;

export type Org = GetOrganizationQuery['organizations'][0];

export interface UseCurrenOrgReturnType {
  org: Org;
  loading?: boolean;
  error?: Error;
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
  const nhost = useNhostClient();

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

  const {
    data: { organizations: [org] } = { organizations: [] },
    loading,
    error,
    refetch,
  } = useGetOrganizationQuery({
    fetchPolicy: 'cache-and-network',
    skip: !shouldFetchOrg,
    variables: {
      orgSlug: (orgSlug as string) ?? '',
    },
  });
  //
  const { data } = useQuery(
    ['project', orgSlug as string],
    async () => {
      const response = await nhost.graphql.post<{
        apps: any[];
      }>({
        query,
        variables: {
          orgSlug: (orgSlug as string) || '',
        },
      });
      return response.body;
    },
    {
      enabled: shouldFetchOrg,
    },
  );

  return {
    org,
    loading: org ? false : loading || isAuthLoading,
    error: error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
    refetch,
  };
}
