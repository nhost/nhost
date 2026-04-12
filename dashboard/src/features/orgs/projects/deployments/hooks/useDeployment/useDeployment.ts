import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';
import {
  PipelineRunSubDocument,
  useGetLegacyDeploymentQuery,
  useGetPipelineRunQuery,
} from '@/generated/graphql';

function useDeployment() {
  const {
    query: { deploymentId },
  } = useRouter();

  const unsubscribe = useRef<(() => void) | null>(null);

  // Try pipeline run first
  const { subscribeToMore, ...pipelineRunResult } = useGetPipelineRunQuery({
    variables: {
      id: deploymentId,
    },
  });

  // Also try legacy deployment (deprecated, query only, no subscription)
  const {
    data: legacyData,
    loading: legacyLoading,
    error: legacyError,
  } = useGetLegacyDeploymentQuery({
    variables: {
      id: deploymentId as string,
    },
    skip: !!pipelineRunResult.data?.pipelineRun,
  });

  const { data } = pipelineRunResult;

  const subscribeToPipelineRun = useCallback(
    () =>
      subscribeToMore({
        document: PipelineRunSubDocument,
        variables: {
          id: deploymentId,
        },
      }),
    [deploymentId, subscribeToMore],
  );

  useEffect(() => {
    if (
      ['pending', 'running'].includes(data?.pipelineRun?.status as string) &&
      unsubscribe.current === null
    ) {
      unsubscribe.current = subscribeToPipelineRun();
    } else if (
      ['succeeded', 'failed', 'aborted'].includes(
        data?.pipelineRun?.status as string,
      ) &&
      unsubscribe.current !== null
    ) {
      unsubscribe.current();
    }
  }, [data?.pipelineRun?.status, subscribeToPipelineRun]);

  useEffect(
    () => () => {
      if (unsubscribe.current !== null) {
        unsubscribe.current();
      }
    },
    [],
  );

  return {
    ...pipelineRunResult,
    legacyDeployment: legacyData?.deployment ?? null,
    legacyLoading,
    legacyError,
  };
}

export default useDeployment;
