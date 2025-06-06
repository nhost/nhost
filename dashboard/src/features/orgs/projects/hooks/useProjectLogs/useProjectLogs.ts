import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { AvailableLogsService } from '@/features/orgs/projects/logs/utils/constants/services';
import { useRemoteApplicationGQLClientWithSubscriptions } from '@/hooks/useRemoteApplicationGQLClientWithSubscriptions';
import { isNotEmptyValue } from '@/lib/utils';
import {
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
        updateQuery: (prev, { subscriptionData }) => {
          // if there is no new data, just return the previous data
          if (!subscriptionData.data) {
            return prev;
          }

          const prevLogs = prev.logs;

          // if there are no previous logs just return the new ones
          if (!prevLogs || prevLogs.length === 0) {
            return subscriptionData.data;
          }

          const newLogs = subscriptionData.data.logs;

          // Next, we need to understand if the new logs are the same as the previous ones.
          // We'll then pick the first log from `prev` and see if we can find it in `subscriptionData.data`.
          // If it exists, we'll assume that the logs are the same and we'll return `prev`.
          // NOTE: We can't compare elements in the array because they are sent out of order.
          // The logs are sorted by timestamp in the LogsBody component.

          const prevAndNewLogsAreTheSame = newLogs.some(
            (log) =>
              log.timestamp === prevLogs[0].timestamp &&
              log.service === prevLogs[0].service,
          );

          if (prevAndNewLogsAreTheSame) {
            return prev;
          }

          // if the logs are not the same, it means we've got new logs. We'll merge the new logs with the existing logs.
          return {
            logs: [...prevLogs, ...newLogs],
          };
        },
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

    if (props.to && subscriptionReturn.current !== null) {
      subscriptionReturn.current();
      subscriptionReturn.current = null;

      return;
    }

    if (props.to) {
      return;
    }

    if (subscriptionReturn.current) {
      subscriptionReturn.current();
      subscriptionReturn.current = null;
    }

    // This will open the websocket connection and it will return a function to close it.
    subscriptionReturn.current = subscribeToMoreLogs();
  }, [props.to, subscribeToMoreLogs, project?.id, loadingProject]);

  const loading = loadingProject || loadingLogs;

  return { loading, ...result };
}

export default useProjectLogs;
