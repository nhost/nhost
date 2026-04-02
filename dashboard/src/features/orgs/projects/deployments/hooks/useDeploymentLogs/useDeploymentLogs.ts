import { gql, useQuery } from '@apollo/client';
import { useCallback, useEffect, useMemo } from 'react';
import { splitGraphqlClient } from '@/utils/splitGraphqlClient';

const GET_DEPLOYMENT_LOGS_QUERY = gql`
  query getDeploymentLogs(
    $appID: String!
    $deploymentID: String!
    $from: Timestamp!
    $to: Timestamp!
  ) {
    getDeploymentLogs(
      appID: $appID
      deploymentID: $deploymentID
      from: $from
      to: $to
    ) {
      timestamp
      task
      log
    }
  }
`;

const GET_DEPLOYMENT_LOGS_SUBSCRIPTION = gql`
  subscription getDeploymentLogsSubscription(
    $appID: String!
    $deploymentID: String!
    $from: Timestamp!
  ) {
    getDeploymentLogs(
      appID: $appID
      deploymentID: $deploymentID
      from: $from
    ) {
      timestamp
      task
      log
    }
  }
`;

export interface DeploymentLog {
  timestamp: string;
  task: string;
  log: string;
}

interface GetDeploymentLogsData {
  getDeploymentLogs: DeploymentLog[];
}

export interface UseDeploymentLogsProps {
  appID: string | undefined;
  deploymentID: string | undefined;
  deploymentStatus: string | null | undefined;
  deploymentStartedAt: string | null | undefined;
  deploymentEndedAt: string | null | undefined;
}

function updateQuery(
  prev: GetDeploymentLogsData,
  { subscriptionData }: { subscriptionData: { data: GetDeploymentLogsData } },
): GetDeploymentLogsData {
  if (!subscriptionData.data) {
    return prev;
  }

  const prevLogs = prev.getDeploymentLogs;
  if (!prevLogs || prevLogs.length === 0) {
    return subscriptionData.data;
  }

  const newLogs = subscriptionData.data.getDeploymentLogs;
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
    getDeploymentLogs: [...prevLogs, ...newLogsToAdd],
  };
}

function useDeploymentLogs({
  appID,
  deploymentID,
  deploymentStatus,
  deploymentStartedAt,
  deploymentEndedAt,
}: UseDeploymentLogsProps) {
  const to = useMemo(
    () => deploymentEndedAt || new Date().toISOString(),
    [deploymentEndedAt],
  );

  const skip = !appID || !deploymentID || !deploymentStartedAt;

  const { subscribeToMore, ...result } = useQuery<GetDeploymentLogsData>(
    GET_DEPLOYMENT_LOGS_QUERY,
    {
      variables: {
        appID,
        deploymentID,
        from: deploymentStartedAt,
        to,
      },
      client: splitGraphqlClient,
      fetchPolicy: 'cache-and-network',
      skip,
    },
  );

  const subscribeToMoreLogs = useCallback(
    () =>
      subscribeToMore({
        document: GET_DEPLOYMENT_LOGS_SUBSCRIPTION,
        variables: {
          appID,
          deploymentID,
          from: deploymentStartedAt,
        },
        updateQuery,
      }),
    [subscribeToMore, appID, deploymentID, deploymentStartedAt],
  );

  useEffect(() => {
    if (
      skip ||
      !['PENDING', 'SCHEDULED'].includes(deploymentStatus as string)
    ) {
      return;
    }

    const unsubscribe = subscribeToMoreLogs();
    return () => {
      unsubscribe();
    };
  }, [skip, deploymentStatus, subscribeToMoreLogs]);

  return result;
}

export default useDeploymentLogs;
