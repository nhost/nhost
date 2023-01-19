import DeploymentListItem from '@/components/deployments/DeploymentListItem';
import {
  useGetDeploymentsSubSubscription,
  useLatestLiveDeploymentSubSubscription,
  useScheduledOrPendingDeploymentsSubSubscription,
} from '@/generated/graphql';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import List from '@/ui/v2/List';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';

type AppDeploymentsProps = {
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
        <div className="cursor-not-allowed">
          <ChevronLeftIcon className="h-4 w-4" />
        </div>
      );
    }
    return (
      <Link
        href={`${window.location.pathname}?page=${currentPage - 1}`}
        passHref
      >
        <a href={`${window.location.pathname}?page=${currentPage - 1}`}>
          <ChevronLeftIcon className="h-4 w-4" />
        </a>
      </Link>
    );
  }
  if (!nextAllowed) {
    return (
      <div className="cursor-not-allowed">
        <ChevronRightIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <Link href={`${window.location.pathname}?page=${currentPage + 1}`} passHref>
      <a href={`${window.location.pathname}?page=${currentPage + 1}`}>
        <ChevronRightIcon className="h-4 w-4" />
      </a>
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

  const { deployments } = deploymentPageData || {};
  const { deployments: scheduledOrPendingDeployments } =
    scheduledOrPendingDeploymentsData || {};

  const latestDeployment = latestDeploymentData?.deployments[0];
  const latestLiveDeployment = latestLiveDeploymentData?.deployments[0];

  const nrOfDeployments = deployments?.length || 0;
  const nextAllowed = !(nrOfDeployments < limit);
  const liveDeploymentId = latestLiveDeployment?.id || '';

  return (
    <div className="mt-6">
      {nrOfDeployments === 0 ? (
        <p className="text-sm text-greyscaleGrey">No deployments yet.</p>
      ) : (
        <div>
          <List className="mt-3 divide-y-1 border-t border-b">
            {deployments.map((deployment) => (
              <DeploymentListItem
                key={deployment.id}
                deployment={deployment}
                isLive={liveDeploymentId === deployment.id}
                showRedeploy={latestDeployment.id === deployment.id}
                disableRedeploy={scheduledOrPendingDeployments.length > 0}
              />
            ))}
          </List>
          <div className="mt-8 flex w-full justify-center">
            <div className="flex items-center">
              <NextPrevPageLink
                direction="prev"
                prevAllowed={page !== 1}
                currentPage={page}
              />
              <div className="mx-2">{page}</div>
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
