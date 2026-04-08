import { useRouter } from 'next/router';
import { Fragment } from 'react';
import { IconLink } from '@/components/common/IconLink';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Divider } from '@/components/ui/v2/Divider';
import { ChevronLeftIcon } from '@/components/ui/v2/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '@/components/ui/v2/icons/ChevronRightIcon';
import { List } from '@/components/ui/v2/List';
import { Text } from '@/components/ui/v2/Text';
import { DeploymentListItem } from '@/features/orgs/projects/deployments/components/DeploymentListItem';
import {
  useGetUnifiedDeploymentsSubSubscription,
  useLatestLiveUnifiedDeploymentSubSubscription,
  usePendingOrRunningUnifiedDeploymentsSubSubscription,
} from '@/generated/graphql';

export type AppDeploymentsProps = {
  appId: string;
};

type NextPrevPageLinkProps = {
  direction: 'next' | 'prev';
  prevAllowed?: boolean;
  nextAllowed?: boolean;
  currentPage: number;
};

function NextPrevPageLink(props: NextPrevPageLinkProps) {
  const { direction, prevAllowed, nextAllowed, currentPage } = props;

  if (direction === 'prev') {
    if (!prevAllowed) {
      return (
        <div className="flex h-8 items-center justify-center">
          <ChevronLeftIcon className="h-4 w-4 cursor-not-allowed" />
        </div>
      );
    }
    return (
      <IconLink
        variant="link"
        underline="none"
        className="flex items-center justify-center py-0"
        href={`${window.location.pathname}?page=${currentPage - 1}`}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </IconLink>
    );
  }
  if (!nextAllowed) {
    return (
      <div className="flex h-8 items-center justify-center">
        <ChevronRightIcon className="h-4 w-4 cursor-not-allowed" />
      </div>
    );
  }
  return (
    <IconLink
      variant="link"
      underline="none"
      className="flex items-center justify-center py-0"
      href={`${window.location.pathname}?page=${currentPage + 1}`}
    >
      <ChevronRightIcon className="h-4 w-4" />
    </IconLink>
  );
}

export default function AppDeployments(props: AppDeploymentsProps) {
  const { appId } = props;

  const router = useRouter();

  // get current page. Default to 1 if not specified
  let page = parseInt(router.query.page as string, 10) || 1;
  page = Math.max(1, page);

  const limit = 10;
  const offset = (page - 1) * limit;

  const { data, loading, error } = useGetUnifiedDeploymentsSubSubscription({
    variables: { appId, limit, offset },
  });

  const { data: latestLiveData, loading: latestLiveLoading } =
    useLatestLiveUnifiedDeploymentSubSubscription({
      variables: { appId },
    });

  const { data: pendingOrRunningData, loading: pendingOrRunningLoading } =
    usePendingOrRunningUnifiedDeploymentsSubSubscription({
      variables: { appId },
    });

  if (loading || latestLiveLoading || pendingOrRunningLoading) {
    return (
      <ActivityIndicator
        delay={500}
        className="mt-12"
        label="Loading deployments..."
      />
    );
  }

  if (error) {
    throw error;
  }

  const deployments = data?.unifiedDeployments ?? [];
  const pendingOrRunning = pendingOrRunningData?.unifiedDeployments ?? [];
  const liveId = latestLiveData?.unifiedDeployments[0]?.id ?? '';

  const nrOfItems = deployments.length;
  const nextAllowed = nrOfItems >= limit;

  return (
    <div className="mt-6">
      {nrOfItems === 0 ? (
        <Text variant="subtitle2">No deployments yet.</Text>
      ) : (
        <div>
          <List className="mt-3 border-y" sx={{ borderColor: 'grey.300' }}>
            {deployments.map((item, index) => (
              <Fragment key={item.id}>
                <DeploymentListItem
                  deployment={item}
                  isLive={liveId === item.id}
                  showRedeploy={index === 0}
                  disableRedeploy={pendingOrRunning.length > 0}
                />

                {index !== deployments.length - 1 && <Divider component="li" />}
              </Fragment>
            ))}
          </List>
          <div className="mt-8 flex w-full justify-center">
            <div className="grid grid-flow-col items-center gap-2">
              <NextPrevPageLink
                direction="prev"
                prevAllowed={page !== 1}
                currentPage={page}
              />
              <Text>{page}</Text>
              <NextPrevPageLink
                direction="next"
                nextAllowed={nextAllowed}
                currentPage={page}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
