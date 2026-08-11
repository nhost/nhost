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

const COMPLETED_LOGS_MARGIN_MS = 60_000;

function getLogsEndTimestamp(endedAt: string | null | undefined): string {
  if (!endedAt) {
    return new Date().toISOString();
  }

  const endedAtTimestamp = new Date(endedAt).getTime();

  if (Number.isNaN(endedAtTimestamp)) {
    return endedAt;
  }

  return new Date(endedAtTimestamp + COMPLETED_LOGS_MARGIN_MS).toISOString();
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
  // Capture `to` once at mount. For completed deployments it includes a short
  // margin after endedAt; for in-progress ones it equals "now". We keep it
  // stable so subscriptions can append logs without refetching and resetting
  // scroll positions when the run completes.
  const [to] = useState(() => getLogsEndTimestamp(endedAt));

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
      // Keep the subscription open for a short grace period so delayed
      // log entries still arrive after the run reaches a terminal status.
      setTimeout(unsubscribe, 10_000);
    };
  }, [skip, status, subscribeToMoreLogs]);

  return result;
}

export default useDeploymentLogs;
