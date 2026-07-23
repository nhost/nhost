import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { Fragment } from 'react';
import { Separator } from '@/components/ui/v3/separator';
import { Spinner } from '@/components/ui/v3/spinner';
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
  allowed: boolean;
  targetPage: number;
};

function NextPrevPageLink({
  direction,
  allowed,
  targetPage,
}: NextPrevPageLinkProps) {
  const Icon = direction === 'prev' ? ChevronLeftIcon : ChevronRightIcon;
  const label = direction === 'prev' ? 'Previous page' : 'Next page';

  if (!allowed) {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md opacity-40"
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <NextLink
      href={`${window.location.pathname}?page=${targetPage}`}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
    >
      <Icon className="h-4 w-4" />
    </NextLink>
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

  // Fetch one extra row to detect whether a next page exists without a
  // separate count query — see `nextAllowed` below.
  const { data, loading, error } = useGetUnifiedDeploymentsSubSubscription({
    variables: { appId, limit: limit + 1, offset },
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
      <Spinner size="xs" wrapperClassName="mt-12 flex-row gap-1.5">
        <span className="text-muted-foreground text-xs">
          Loading deployments...
        </span>
      </Spinner>
    );
  }

  if (error) {
    throw error;
  }

  const fetched = data?.unifiedDeployments ?? [];
  const deployments = fetched.slice(0, limit);
  const nextAllowed = fetched.length > limit;
  const pendingOrRunning = pendingOrRunningData?.unifiedDeployments ?? [];
  const liveId = latestLiveData?.unifiedDeployments[0]?.id ?? '';

  const nrOfItems = deployments.length;

  return (
    <div className="mt-6">
      {nrOfItems === 0 ? (
        <p className="font-medium text-sm">No deployments yet.</p>
      ) : (
        <div>
          <ul className="mt-3 border-border border-y">
            {deployments.map((item, index) => (
              <Fragment key={item.id}>
                <DeploymentListItem
                  deployment={item}
                  isLive={liveId === item.id}
                  showRedeploy={page === 1 && index === 0}
                  disableRedeploy={pendingOrRunning.length > 0}
                />

                {index !== deployments.length - 1 && (
                  <li className="list-none">
                    <Separator />
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
          <div className="mt-8 flex w-full justify-center">
            <div className="grid grid-flow-col items-center gap-2">
              <NextPrevPageLink
                direction="prev"
                allowed={page !== 1}
                targetPage={page - 1}
              />
              <span>{page}</span>
              <NextPrevPageLink
                direction="next"
                allowed={nextAllowed}
                targetPage={page + 1}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
