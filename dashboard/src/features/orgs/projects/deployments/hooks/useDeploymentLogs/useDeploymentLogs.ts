import { useCallback, useEffect, useState } from 'react';
import {
  type GetPipelineRunLogsQuery,
  GetPipelineRunLogsSubscriptionDocument,
  useGetPipelineRunLogsQuery,
} from '@/generated/graphql';
import { splitGraphqlClient } from '@/utils/splitGraphqlClient';

export type DeploymentLog =
  GetPipelineRunLogsQuery['getPipelineRunLogs'][number];

export interface UseDeploymentLogsProps {
  appID: string | undefined;
  pipelineRunID: string | undefined;
  status: string | null | undefined;
  startedAt: string | null | undefined;
  endedAt: string | null | undefined;
}

function updateQuery(
  prev: GetPipelineRunLogsQuery,
  { subscriptionData }: { subscriptionData: { data: GetPipelineRunLogsQuery } },
): GetPipelineRunLogsQuery {
  if (!subscriptionData.data) {
    return prev;
  }

  const prevLogs = prev.getPipelineRunLogs;
  if (!prevLogs || prevLogs.length === 0) {
    return subscriptionData.data;
  }

  const newLogs = subscriptionData.data.getPipelineRunLogs;
  const latestPrevTimestamp = Math.max(
    ...prevLogs.map((log) => new Date(log.timestamp).getTime()),
  );

  const newLogsToAdd = newLogs.filter(
    (log) => new Date(log.timestamp).getTime() > latestPrevTimestamp,
  );

  if (newLogsToAdd.length === 0) {
    return prev;
  }

  return {
    getPipelineRunLogs: [...prevLogs, ...newLogsToAdd],
  };
}

function useDeploymentLogs({
  appID,
  pipelineRunID,
  status,
  startedAt,
  endedAt,
}: UseDeploymentLogsProps) {
  // Capture `to` once at mount. For completed deployments it equals endedAt;
  // for in-progress ones it equals "now". We never update it afterwards so
  // that the query variables stay stable — the subscription delivers any new
  // logs while the run is active, and when it completes there is no redundant
  // refetch that would reset scroll positions.
  const [to] = useState(() => endedAt || new Date().toISOString());

  const skip = !appID || !pipelineRunID || !startedAt;

  const { subscribeToMore, ...result } = useGetPipelineRunLogsQuery({
    variables: {
      appID: appID as string,
      pipelineRunID: pipelineRunID as string,
      from: startedAt as string,
      to,
    },
    client: splitGraphqlClient,
    fetchPolicy: 'cache-and-network',
    skip,
  });

  const subscribeToMoreLogs = useCallback(
    () =>
      subscribeToMore({
        document: GetPipelineRunLogsSubscriptionDocument,
        variables: {
          appID,
          pipelineRunID,
          from: startedAt,
        },
        updateQuery,
      }),
    [subscribeToMore, appID, pipelineRunID, startedAt],
  );

  useEffect(() => {
    if (skip || !['pending', 'running'].includes(status as string)) {
      return;
    }

    const unsubscribe = subscribeToMoreLogs();
    return () => {
      unsubscribe();
    };
  }, [skip, status, subscribeToMoreLogs]);

  return result;
}

export default useDeploymentLogs;
