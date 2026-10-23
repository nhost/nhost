import {
  useLatestLiveUnifiedDeploymentSubSubscription,
  usePendingOrRunningUnifiedDeploymentsSubSubscription,
} from '@/generated/graphql';

export default function useDeploymentActivity(appId: string | undefined) {
  const live = useLatestLiveUnifiedDeploymentSubSubscription({
    variables: { appId },
    skip: !appId,
  });
  const pending = usePendingOrRunningUnifiedDeploymentsSubSubscription({
    variables: { appId },
    skip: !appId,
  });
  const error = live.error ?? pending.error;

  return {
    liveDeployment: live.data?.unifiedDeployments[0] ?? null,
    hasDeploymentInProgress: (pending.data?.unifiedDeployments.length ?? 0) > 0,
    ready:
      !!appId &&
      !live.loading &&
      !pending.loading &&
      !!live.data &&
      !!pending.data &&
      !error,
    error,
  };
}
