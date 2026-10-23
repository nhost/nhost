import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useGitHubAccessToken } from '@/features/orgs/projects/common/hooks/useGitHubAccessToken';
import { useDeploySuggestions } from '@/features/orgs/projects/deployments/hooks/useDeploySuggestions';
import { canResolveDeploymentRef } from '@/features/orgs/projects/deployments/utils/commit-relation';
import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import {
  compareGitHubCommits,
  GitHubAPIError,
  type GitHubCommit,
  type GitHubMatchingRef,
  getGitHubCommit,
  getGitHubRepository,
} from '@/lib/github';

import { SESSION_QUERY_OPTIONS } from './session-query-options';

type Access = 'loading' | 'ready' | 'no-access' | 'unavailable';

interface NewDeploymentSessionOptions {
  appId: string;
  fullName: string;
  productionBranch: string;
  liveSHA: string | null | undefined;
  ready: boolean;
}

function getRefError(error: unknown): string {
  if (
    error instanceof GitHubAPIError &&
    (error.status === 404 || error.status === 422)
  ) {
    return 'No branch, tag or commit matches';
  }
  return 'GitHub is unavailable right now';
}

function useResolvedRef({
  queryKey,
  accessToken,
  fullName,
  input,
  picked,
  enabled,
  onError,
}: {
  queryKey: string[];
  accessToken: string;
  fullName: string;
  input: string;
  picked: boolean;
  enabled: boolean;
  onError: (error: unknown) => void;
}) {
  const [debouncedInput, setDebouncedInput] = useState(input);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedInput(input), 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const ref = input;
  const currentInput = picked || input === debouncedInput;
  const resolvable = canResolveDeploymentRef(input);
  const canResolve = enabled && currentInput && resolvable;
  const resolved = useQuery({
    ...SESSION_QUERY_OPTIONS,
    queryKey: [...queryKey, 'resolve', ref],
    enabled: canResolve,
    queryFn: ({ signal }) =>
      getGitHubCommit(accessToken, fullName, ref, signal),
    onError,
  });
  // Never retain a previous input's target during the debounce or a failed request.
  const target =
    canResolve && resolved.isSuccess && /^[a-f\d]{40}$/i.test(resolved.data.sha)
      ? resolved.data
      : null;

  return {
    target,
    resolving:
      enabled &&
      resolvable &&
      (!currentInput || resolved.isInitialLoading || resolved.isFetching),
    refError:
      canResolve && resolved.isError ? getRefError(resolved.error) : null,
  };
}

function getAccessStatus(
  tokenStatus: ReturnType<typeof useGitHubAccessToken>['status'],
  repository: { isError: boolean; isSuccess: boolean },
  accessError: Access | undefined,
): Access {
  if (accessError) {
    return accessError;
  }
  if (tokenStatus !== 'loading' && tokenStatus !== 'ready') {
    return 'no-access';
  }
  if (repository.isError) {
    return 'unavailable';
  }
  if (tokenStatus === 'ready' && repository.isSuccess) {
    return 'ready';
  }
  return 'loading';
}

function getAccessError(
  error: unknown,
  checkingRepository: boolean,
): Access | undefined {
  if (!(error instanceof GitHubAPIError)) {
    return undefined;
  }
  if (error.rateLimited) {
    return 'unavailable';
  }
  if (
    error.status === 401 ||
    (checkingRepository && (error.status === 403 || error.status === 404))
  ) {
    return 'no-access';
  }
  return undefined;
}

function useDeploymentSelection(access: Access, productionBranch: string) {
  const [selection, setSelection] = useState<{
    access: Access;
    input: string;
    ref: string;
    picked: boolean;
    deployment: UnifiedDeploymentRowFragment | null;
  }>();
  // An access change starts an empty fallback search rather than retaining a GitHub ref.
  const current = selection?.access === access ? selection : null;
  const input = current?.input ?? (access === 'ready' ? productionBranch : '');
  return {
    input,
    ref: current?.ref ?? input,
    picked: current?.picked ?? false,
    searching: Boolean(current && !current.picked),
    pickedDeployment: current?.deployment,
    setInput: (value: string) =>
      setSelection({
        access,
        input: value,
        ref: value,
        picked: false,
        deployment: null,
      }),
    pickRef: (ref: GitHubMatchingRef) =>
      setSelection({
        access,
        input: ref.name,
        ref: ref.qualifiedRef,
        picked: true,
        deployment: null,
      }),
    pickCommit: (commit: GitHubCommit) =>
      setSelection({
        access,
        input: commit.sha,
        ref: commit.sha,
        picked: true,
        deployment: null,
      }),
    pickDeployment: (deployment: UnifiedDeploymentRowFragment) =>
      setSelection({
        access,
        input: deployment.commitSHA ?? '',
        ref: deployment.commitSHA ?? '',
        picked: true,
        deployment,
      }),
  };
}

function getStoredDeployment(
  access: Access,
  deployment: UnifiedDeploymentRowFragment | null | undefined,
) {
  if (access !== 'no-access' && access !== 'unavailable') {
    return null;
  }
  if (!deployment?.commitSHA || !/^[a-f\d]{40}$/i.test(deployment.commitSHA)) {
    return null;
  }
  return { ...deployment, commitSHA: deployment.commitSHA };
}

function useCommitComparison({
  queryKey,
  accessToken,
  fullName,
  liveSHA,
  targetSHA,
  enabled,
  ready,
  onError,
}: {
  queryKey: string[];
  accessToken: string;
  fullName: string;
  liveSHA: string | null | undefined;
  targetSHA: string | undefined;
  enabled: boolean;
  ready: boolean;
  onError: (error: unknown) => void;
}) {
  const needsComparison =
    enabled && Boolean(targetSHA && liveSHA && liveSHA !== targetSHA);
  const comparison = useQuery({
    ...SESSION_QUERY_OPTIONS,
    queryKey: [...queryKey, 'compare', liveSHA, targetSHA],
    enabled: ready && needsComparison,
    queryFn: ({ signal }) =>
      compareGitHubCommits(
        accessToken,
        fullName,
        liveSHA ?? '',
        targetSHA ?? '',
        signal,
      ),
    onError,
  });
  return {
    comparing:
      needsComparison && (comparison.isInitialLoading || comparison.isFetching),
    comparison: needsComparison ? comparison.data : undefined,
    compareFailed: needsComparison && comparison.isError,
  };
}

function storedCommit(
  deployment: UnifiedDeploymentRowFragment & { commitSHA: string },
): GitHubCommit {
  return {
    sha: deployment.commitSHA,
    message: deployment.commitMessage ?? '',
    authorName: deployment.commitUserName ?? '',
    avatarUrl: deployment.commitUserAvatarUrl ?? null,
    date: deployment.createdAt ?? null,
  };
}

export default function useNewDeploymentSession({
  appId,
  fullName,
  productionBranch,
  liveSHA,
  ready,
}: NewDeploymentSessionOptions) {
  const token = useGitHubAccessToken();
  const accessToken = token.accessToken ?? '';
  const queryClient = useQueryClient();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [accessError, setAccessError] = useState<Access>();
  const queryKey = ['new-deployment', sessionId, fullName];

  useEffect(() => {
    const sessionKey = ['new-deployment', sessionId];
    return () => {
      void queryClient.cancelQueries({ queryKey: sessionKey });
      queryClient.removeQueries({ queryKey: sessionKey });
    };
  }, [queryClient, sessionId]);

  function handleError(error: unknown, checkingRepository = false) {
    const status = getAccessError(error, checkingRepository);
    if (status) {
      setAccessError(status);
    }
  }

  const repository = useQuery({
    ...SESSION_QUERY_OPTIONS,
    queryKey: [...queryKey, 'repository'],
    enabled: token.status === 'ready' && !accessError,
    queryFn: ({ signal }) => getGitHubRepository(accessToken, fullName, signal),
    onError: (error) => handleError(error, true),
  });
  const access = getAccessStatus(token.status, repository, accessError);
  const selection = useDeploymentSelection(access, productionBranch);
  const { input, pickedDeployment } = selection;
  const suggestions = useDeploySuggestions({
    appId,
    query: input,
    queryKey,
    fullName,
    productionBranch,
    accessToken,
    enabled: access === 'ready',
    searching: selection.searching,
    onError: handleError,
  });
  const resolved = useResolvedRef({
    queryKey,
    accessToken,
    fullName,
    input: selection.ref,
    picked: selection.picked,
    enabled: access === 'ready',
    onError: handleError,
  });
  const storedDeployment = getStoredDeployment(access, pickedDeployment);
  const target = storedDeployment
    ? storedCommit(storedDeployment)
    : resolved.target;
  const comparison = useCommitComparison({
    queryKey,
    accessToken,
    fullName,
    liveSHA,
    targetSHA: target?.sha,
    enabled: access === 'ready',
    ready,
    onError: handleError,
  });

  return {
    ...resolved,
    ...selection,
    ...comparison,
    suggestions,
    target,
    storedDeployment,
    queryKey,
    tokenStatus: token.status,
    access,

    refRequiresAccess:
      (access === 'no-access' || access === 'unavailable') &&
      Boolean(pickedDeployment) &&
      !storedDeployment,
  };
}
