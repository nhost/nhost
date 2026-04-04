import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';
import {
  PipelineRunSubDocument,
  useGetPipelineRunQuery,
} from '@/generated/graphql';

function useDeployment() {
  const {
    query: { deploymentId },
  } = useRouter();

  const unsubscribe = useRef<(() => void) | null>(null);

  const { subscribeToMore, ...result } = useGetPipelineRunQuery({
    variables: {
      id: deploymentId,
    },
  });
  const { data } = result;

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

  return result;
}

export default useDeployment;
