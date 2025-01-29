import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Divider } from '@/components/ui/v2/Divider';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ChevronLeftIcon } from '@/components/ui/v2/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '@/components/ui/v2/icons/ChevronRightIcon';
import { List } from '@/components/ui/v2/List';
import { Text } from '@/components/ui/v2/Text';
import { DeploymentListItem } from '@/features/projects/deployments/components/DeploymentListItem';
import {
  useGetDeploymentsSubSubscription,
  useLatestLiveDeploymentSubSubscription,
  useScheduledOrPendingDeploymentsSubSubscription,
} from '@/generated/graphql';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment } from 'react';

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
      return <ChevronLeftIcon className="h-4 w-4 cursor-not-allowed" />;
    }
    return (
      <Link
        href={`${window.location.pathname}?page=${currentPage - 1}`}
        passHref
        legacyBehavior
      >
        <IconButton variant="borderless" color="secondary">
          <ChevronLeftIcon className="h-4 w-4" />
        </IconButton>
      </Link>
    );
  }
  if (!nextAllowed) {
    return <ChevronRightIcon className="h-4 w-4 cursor-not-allowed" />;
  }
  return (
    <Link
      href={`${window.location.pathname}?page=${currentPage + 1}`}
      passHref
      legacyBehavior
    >
      <IconButton variant="borderless" color="secondary">
        <ChevronRightIcon className="h-4 w-4" />
      </IconButton>
    </Link>
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

  const {
    data: deploymentPageData,
    loading: deploymentPageLoading,
    error,
  } = useGetDeploymentsSubSubscription({
    variables: { id: appId, limit, offset },
  });

  const { data: latestDeploymentData, loading: latestDeploymentLoading } =
    useGetDeploymentsSubSubscription({
      variables: { id: appId, limit: 1, offset: 0 },
    });

  const {
    data: latestLiveDeploymentData,
    loading: latestLiveDeploymentLoading,
  } = useLatestLiveDeploymentSubSubscription({ variables: { appId } });

  const {
    data: scheduledOrPendingDeploymentsData,
    loading: scheduledOrPendingDeploymentsLoading,
  } = useScheduledOrPendingDeploymentsSubSubscription({ variables: { appId } });

  const loading =
    deploymentPageLoading ||
    scheduledOrPendingDeploymentsLoading ||
    latestDeploymentLoading ||
    latestLiveDeploymentLoading;

  if (loading) {
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

  const { deployments } = deploymentPageData || { deployments: [] };
  const { deployments: scheduledOrPendingDeployments } =
    scheduledOrPendingDeploymentsData || { deployments: [] };
  const isDeploymentInProgress = deployments?.some((deployment) =>
    ['PENDING', 'SCHEDULED'].includes(deployment.deploymentStatus),
  );

  const latestDeployment = latestDeploymentData?.deployments[0];
  const latestLiveDeployment = latestLiveDeploymentData?.deployments[0];

  const nrOfDeployments = deployments?.length || 0;
  const nextAllowed = !(nrOfDeployments < limit);
  const liveDeploymentId = latestLiveDeployment?.id || '';

  return (
    <div className="mt-6">
      {nrOfDeployments === 0 ? (
        <Text variant="subtitle2">No deployments yet.</Text>
      ) : (
        <div>
          <List className="mt-3 border-y" sx={{ borderColor: 'grey.300' }}>
            {deployments.map((deployment, index) => (
              <Fragment key={deployment.id}>
                <DeploymentListItem
                  deployment={deployment}
                  isLive={liveDeploymentId === deployment.id}
                  showRedeploy={latestDeployment.id === deployment.id}
                  disableRedeploy={
                    scheduledOrPendingDeployments?.length > 0 ||
                    isDeploymentInProgress
                  }
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
