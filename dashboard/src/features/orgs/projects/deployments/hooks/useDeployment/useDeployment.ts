import {
  DeploymentSubDocument,
  useGetDeploymentQuery,
} from '@/generated/graphql';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';

function useDeployment() {
  const {
    query: { deploymentId },
  } = useRouter();

  const unsubscribe = useRef<(() => void) | null>(null);

  const { subscribeToMore, ...result } = useGetDeploymentQuery({
    variables: {
      id: deploymentId,
    },
  });
  const { data } = result;

  const subscribeToDeployment = useCallback(
    () =>
      subscribeToMore({
        document: DeploymentSubDocument,
        variables: {
          id: deploymentId,
        },
      }),
    [deploymentId, subscribeToMore],
  );

  useEffect(() => {
    if (
      ['PENDING', 'SCHEDULED'].includes(
        data?.deployment?.deploymentStatus as string,
      ) &&
      unsubscribe.current === null
    ) {
      unsubscribe.current = subscribeToDeployment();
    } else if (
      ['DEPLOYED', 'FAILED'].includes(
        data?.deployment?.deploymentStatus as string,
      ) &&
      unsubscribe.current !== null
    ) {
      unsubscribe.current();
    }
  }, [data?.deployment?.deploymentStatus, subscribeToDeployment]);

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
