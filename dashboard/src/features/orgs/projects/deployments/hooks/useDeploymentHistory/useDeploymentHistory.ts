import { useApolloClient } from '@apollo/client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SESSION_QUERY_OPTIONS } from '@/features/orgs/projects/deployments/hooks/useNewDeploymentSession/session-query-options';
import {
  dedupeDeploymentsByCommit,
  escapeILike,
  rankBySha,
} from '@/features/orgs/projects/deployments/utils/deploy-suggestions';
import {
  SearchUnifiedDeploymentsDocument,
  type SearchUnifiedDeploymentsQuery,
  type SearchUnifiedDeploymentsQueryVariables,
  useGetUnifiedDeploymentsSubSubscription,
} from '@/generated/graphql';

const HISTORY_LIMIT = 50;

export default function useDeploymentHistory({
  appId,
  input,
  queryKey,
}: {
  appId: string;
  input: string;
  queryKey: string[];
}) {
  const client = useApolloClient();
  const [debouncedInput, setDebouncedInput] = useState(input);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedInput(input), 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const searching = input.length >= 2;
  const currentInput = input === debouncedInput;
  const recent = useGetUnifiedDeploymentsSubSubscription({
    variables: { appId, limit: HISTORY_LIMIT, offset: 0 },
    skip: searching,
  });
  const search = useQuery({
    ...SESSION_QUERY_OPTIONS,
    queryKey: [...queryKey, 'history', appId, debouncedInput],
    enabled: searching && currentInput,
    queryFn: async ({ signal }) => {
      const escaped = escapeILike(debouncedInput);
      const { data } = await client.query<
        SearchUnifiedDeploymentsQuery,
        SearchUnifiedDeploymentsQueryVariables
      >({
        query: SearchUnifiedDeploymentsDocument,
        variables: {
          appId,
          messagePattern: `%${escaped}%`,
          shaPattern: `${escaped}%`,
          limit: HISTORY_LIMIT,
        },
        fetchPolicy: 'no-cache',
        context: {
          queryDeduplication: false,
          fetchOptions: { signal },
        },
      });
      return data.unifiedDeployments;
    },
  });
  const deployments = searching
    ? (currentInput && search.data) || []
    : (recent.data?.unifiedDeployments ?? []);

  return {
    deployments: rankBySha(
      dedupeDeploymentsByCommit(deployments),
      input,
      (deployment) => deployment.commitSHA,
    ).slice(0, 5),
    loading: searching
      ? !currentInput || search.isInitialLoading || search.isFetching
      : recent.loading,
    error: searching ? search.isError : Boolean(recent.error),
  };
}
