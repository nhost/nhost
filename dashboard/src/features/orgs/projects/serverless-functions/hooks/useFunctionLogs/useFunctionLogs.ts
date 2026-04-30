import { useCallback, useEffect, useRef } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import type { GetFunctionsLogsQuery } from '@/utils/__generated__/graphql';
import {
  GetFunctionsLogsSubscriptionDocument,
  useGetFunctionsLogsQuery,
} from '@/utils/__generated__/graphql';
import { localLogsClient } from '@/utils/localLogsClient';
import { splitGraphqlClient } from '@/utils/splitGraphqlClient';

export interface UseFunctionLogsProps {
  from: string;
  to: string | null;
  path: string;
  regexFilter: string;
}

export function updateQuery(
  prev: GetFunctionsLogsQuery,
  { subscriptionData }: { subscriptionData: { data: GetFunctionsLogsQuery } },
): GetFunctionsLogsQuery {
  if (!subscriptionData.data) {
    return prev;
  }

  const prevLogs = prev.getFunctionsLogs;

  if (!prevLogs || prevLogs.length === 0) {
    return subscriptionData.data;
  }

  const newLogs = subscriptionData.data.getFunctionsLogs;

  const latestPrevTimestamp = Math.max(
    ...prevLogs.map((log) => new Date(log.timestamp).getTime()),
  );

  const newLogsToAdd = newLogs.filter(
    (log) => new Date(log.timestamp).getTime() > latestPrevTimestamp,
  );

  return {
    ...prev,
    getFunctionsLogs: [...prevLogs, ...newLogsToAdd],
  };
}

export default function useFunctionLogs({
  from,
  to,
  path,
  regexFilter,
}: UseFunctionLogsProps) {
  const isPlatform = useIsPlatform();
  const { project, loading: loadingProject } = useProject();
  const subscriptionReturn = useRef<(() => void) | null>(null);

  const {
    data,
    loading: loadingLogs,
    error,
    subscribeToMore,
  } = useGetFunctionsLogsQuery({
    variables: {
      appID: project?.id,
      from,
      to,
      path,
      regexFilter,
    },
    client: isPlatform ? splitGraphqlClient : localLogsClient,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: !project?.id,
  });

  const subscribeToMoreLogs = useCallback(
    () =>
      subscribeToMore({
        document: GetFunctionsLogsSubscriptionDocument,
        variables: {
          appID: project?.id,
          from,
          path,
          regexFilter,
        },
        updateQuery,
      }),
    [subscribeToMore, project?.id, from, path, regexFilter],
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

    if (to !== null && subscriptionReturn.current !== null) {
      subscriptionReturn.current();
      subscriptionReturn.current = null;
    }

    if (to === null) {
      subscriptionReturn.current?.();
      subscriptionReturn.current = subscribeToMoreLogs();
    }
  }, [to, subscribeToMoreLogs, project?.id, loadingProject]);

  const loading = loadingProject || loadingLogs;

  return { data, loading, error };
}
