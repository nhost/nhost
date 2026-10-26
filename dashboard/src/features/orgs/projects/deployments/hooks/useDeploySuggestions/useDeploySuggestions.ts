import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useDeploymentHistory } from '@/features/orgs/projects/deployments/hooks/useDeploymentHistory';
import { SESSION_QUERY_OPTIONS } from '@/features/orgs/projects/deployments/hooks/useNewDeploymentSession/session-query-options';
import { canResolveDeploymentRef } from '@/features/orgs/projects/deployments/utils/commit-relation';
import { filterCommits } from '@/features/orgs/projects/deployments/utils/deploy-suggestions';
import { listGitHubBranchCommits, listGitHubMatchingRefs } from '@/lib/github';

interface DeploySuggestionsOptions {
  appId: string;
  query: string;
  queryKey: string[];
  fullName: string;
  productionBranch: string;
  accessToken: string;
  enabled: boolean;
  searching: boolean;
  onError: (error: unknown) => void;
}

function useMatchingRefs({
  kind,
  prefix,
  queryKey,
  accessToken,
  fullName,
  enabled,
  onError,
}: Pick<
  DeploySuggestionsOptions,
  'queryKey' | 'accessToken' | 'fullName' | 'enabled' | 'onError'
> & { kind: 'heads' | 'tags'; prefix: string }) {
  const refs = useQuery({
    ...SESSION_QUERY_OPTIONS,
    queryKey: [...queryKey, 'matching-refs', kind, prefix],
    enabled,
    queryFn: ({ signal }) =>
      listGitHubMatchingRefs(accessToken, fullName, kind, prefix, signal),
    onError,
  });
  return {
    refs: enabled ? (refs.data?.slice(0, 5) ?? []) : [],
    loading: enabled && refs.isFetching,
  };
}

export default function useDeploySuggestions({
  appId,
  query,
  queryKey,
  fullName,
  productionBranch,
  accessToken,
  enabled,
  searching,
  onError,
}: DeploySuggestionsOptions) {
  const history = useDeploymentHistory({ appId, input: query, queryKey });
  const [prefix, setPrefix] = useState(query);
  useEffect(() => {
    const timeout = setTimeout(() => setPrefix(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const searchesRefs = enabled && searching && canResolveDeploymentRef(query);
  const refsEnabled = searchesRefs && query === prefix;
  const refOptions = {
    queryKey,
    accessToken,
    fullName,
    prefix: query,
    enabled: refsEnabled,
    onError,
  };
  const branches = useMatchingRefs({ ...refOptions, kind: 'heads' });
  const tags = useMatchingRefs({ ...refOptions, kind: 'tags' });
  const commits = useQuery({
    ...SESSION_QUERY_OPTIONS,
    queryKey: [...queryKey, 'branch-commits', productionBranch],
    enabled: enabled && Boolean(productionBranch),
    queryFn: ({ signal }) =>
      listGitHubBranchCommits(accessToken, fullName, productionBranch, signal),
    onError,
  });

  return {
    history,
    branches: branches.refs,
    tags: tags.refs,
    commits:
      enabled && searching ? filterCommits(commits.data ?? [], query) : [],
    loading:
      history.loading ||
      (searchesRefs &&
        (query !== prefix || branches.loading || tags.loading)) ||
      (enabled && searching && commits.isInitialLoading),
  };
}
