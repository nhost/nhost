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
  useGetPipelineRunsSubSubscription,
  useLatestSucceededPipelineRunSubSubscription,
  usePendingOrRunningPipelineRunsSubSubscription,
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
      href={`${window.location.pathname}?page=${currentPage - 1}`}
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

  const {
    data: pipelineRunPageData,
    loading: pipelineRunPageLoading,
    error,
  } = useGetPipelineRunsSubSubscription({
    variables: { id: appId, limit, offset },
  });

  const { data: latestPipelineRunData, loading: latestPipelineRunLoading } =
    useGetPipelineRunsSubSubscription({
      variables: { id: appId, limit: 1, offset: 0 },
    });

  const { data: latestSucceededData, loading: latestSucceededLoading } =
    useLatestSucceededPipelineRunSubSubscription({ variables: { appId } });

  const { data: pendingOrRunningData, loading: pendingOrRunningLoading } =
    usePendingOrRunningPipelineRunsSubSubscription({ variables: { appId } });

  const loading =
    pipelineRunPageLoading ||
    pendingOrRunningLoading ||
    latestPipelineRunLoading ||
    latestSucceededLoading;

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

  const pipelineRuns = pipelineRunPageData?.pipelineRuns ?? [];
  const pendingOrRunningRuns = pendingOrRunningData?.pipelineRuns ?? [];
  const isInProgress = pipelineRuns.some((run) =>
    ['pending', 'running'].includes(run.status as string),
  );

  const latestRun = latestPipelineRunData?.pipelineRuns[0];
  const latestSucceededRun = latestSucceededData?.pipelineRuns[0];

  const nrOfRuns = pipelineRuns.length;
  const nextAllowed = !(nrOfRuns < limit);
  const liveRunId = latestSucceededRun?.id || '';

  return (
    <div className="mt-6">
      {nrOfRuns === 0 ? (
        <Text variant="subtitle2">No deployments yet.</Text>
      ) : (
        <div>
          <List className="mt-3 border-y" sx={{ borderColor: 'grey.300' }}>
            {pipelineRuns.map((run, index) => (
              <Fragment key={run.id}>
                <DeploymentListItem
                  pipelineRun={run}
                  isLive={liveRunId === run.id}
                  showRedeploy={latestRun?.id === run.id}
                  disableRedeploy={
                    pendingOrRunningRuns.length > 0 || isInProgress
                  }
                />

                {index !== pipelineRuns.length - 1 && (
                  <Divider component="li" />
                )}
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
