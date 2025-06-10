import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { AvailableLogsService } from '@/features/orgs/projects/logs/utils/constants/services';
import { useRemoteApplicationGQLClientWithSubscriptions } from '@/hooks/useRemoteApplicationGQLClientWithSubscriptions';
import { isNotEmptyValue } from '@/lib/utils';
import {
  type GetProjectLogsQuery,
  GetLogsSubscriptionDocument,
  useGetProjectLogsQuery,
} from '@/utils/__generated__/graphql';
import { useCallback, useEffect, useRef } from 'react';

export interface UseProjectLogsProps {
  from: string;
  to: string | null;
  service: AvailableLogsService;
  regexFilter: string;
}

export function updateQuery(
  prev: GetProjectLogsQuery,
  { subscriptionData }: { subscriptionData: { data: GetProjectLogsQuery } },
) {
  if (!subscriptionData.data) {
    return prev;
  }

  const prevLogs = prev.logs;

  if (!prevLogs || prevLogs.length === 0) {
    return subscriptionData.data;
  }

  const newLogs = subscriptionData.data.logs;

  // Get the latest timestamp from existing logs
  const latestPrevTimestamp = Math.max(
    ...prevLogs.map((log) => new Date(log.timestamp).getTime()),
  );

  // Only include logs that are newer than our latest existing log
  const newLogsToAdd = newLogs.filter(
    (log) => new Date(log.timestamp).getTime() > latestPrevTimestamp,
  );

  return {
    logs: [...prevLogs, ...newLogsToAdd],
  };
}

function useProjectLogs(props: UseProjectLogsProps) {
  const { project, loading: loadingProject } = useProject();
  // create a client that sends http requests to Hasura but websocket requests to Bragi
  const clientWithSplit = useRemoteApplicationGQLClientWithSubscriptions();
  const subscriptionReturn = useRef(null);

  const {
    loading: loadingLogs,
    subscribeToMore,
    ...result
  } = useGetProjectLogsQuery({
    variables: { appID: project?.id, ...props },
    client: clientWithSplit,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: !project,
  });

  const subscribeToMoreLogs = useCallback(
    () =>
      subscribeToMore({
        document: GetLogsSubscriptionDocument,
        variables: {
          appID: project?.id,
          service:
            props.service === AvailableLogsService.JOB_BACKUP
              ? 'job-backup.+' // Use regex pattern to match any job-backup services
              : props.service,
          from: props.from,
          regexFilter: props.regexFilter,
        },
        updateQuery,
      }),
    [
      subscribeToMore,
      project?.id,
      props.from,
      props.service,
      props.regexFilter,
    ],
  );

  useEffect(
    () => () => {
      if (isNotEmptyValue(subscriptionReturn.current)) {
        subscriptionReturn.current();
      }
    },
    [],
  );

  useEffect(() => {
    if (!project?.id || loadingProject) {
      return;
    }

    if (props.to !== null && subscriptionReturn.current !== null) {
      subscriptionReturn.current();
      subscriptionReturn.current = null;
    }

    if (props.to === null) {
      subscriptionReturn.current?.();
      subscriptionReturn.current = subscribeToMoreLogs();
    }
  }, [props.to, subscribeToMoreLogs, project?.id, loadingProject]);

  const loading = loadingProject || loadingLogs;

  return { loading, ...result };
}

export default useProjectLogs;
