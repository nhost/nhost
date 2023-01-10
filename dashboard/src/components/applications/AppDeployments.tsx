import type { DeploymentRowFragment } from '@/generated/graphql';
import { useGetDeploymentsSubSubscription } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import DelayedLoading from '@/ui/DelayedLoading';
import Status, { StatusEnum } from '@/ui/Status';
import type { DeploymentStatus } from '@/ui/StatusCircle';
import { StatusCircle } from '@/ui/StatusCircle';
import { getLastLiveDeployment } from '@/utils/helpers';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid';
import {
  differenceInSeconds,
  formatDistanceToNowStrict,
  parseISO,
} from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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

type AppDeploymentDurationProps = {
  startedAt: string;
  endedAt: string;
};

export function AppDeploymentDuration({
  startedAt,
  endedAt,
}: AppDeploymentDurationProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (!endedAt) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => {
      clearInterval(interval);
    };
  }, [endedAt]);

  const totalDurationInSeconds = differenceInSeconds(
    endedAt ? parseISO(endedAt) : currentTime,
    parseISO(startedAt),
  );

  if (totalDurationInSeconds > 1200) {
    return <div>20+m</div>;
  }

  const durationMins = Math.floor(totalDurationInSeconds / 60);
  const durationSecs = totalDurationInSeconds % 60;

  return (
    <div
      style={{
        fontVariantNumeric: 'tabular-nums',
      }}
      className="self-center font-display text-sm+ text-greyscaleDark"
    >
      {durationMins}m {durationSecs}s
    </div>
  );
}

type AppDeploymentRowProps = {
  deployment: DeploymentRowFragment;
  isDeploymentLive: boolean;
};

export function AppDeploymentRow({
  deployment,
  isDeploymentLive,
}: AppDeploymentRowProps) {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  const { commitMessage } = deployment;

  return (
    <div className="flex flex-row items-center px-2 py-4">
      <div className="mr-2 flex items-center justify-center">
        <Avatar
          name={deployment.commitUserName}
          avatarUrl={deployment.commitUserAvatarUrl}
          className="h-8 w-8"
        />
      </div>
      <div className="mx-4 w-full">
        <Link
          href={`/${currentWorkspace.slug}/${currentApplication.slug}/deployments/${deployment.id}`}
          passHref
        >
          <a
            href={`/${currentWorkspace.slug}/${currentApplication.slug}/deployments/${deployment.id}`}
          >
            <div className="max-w-md truncate text-sm+ font-normal text-greyscaleDark">
              {commitMessage?.trim() || (
                <span className="pr-1 font-normal italic">
                  No commit message
                </span>
              )}
            </div>
            <div className="text-sm+ text-greyscaleGrey">
              {formatDistanceToNowStrict(
                parseISO(deployment.deploymentStartedAt),
                {
                  addSuffix: true,
                },
              )}
            </div>
          </a>
        </Link>
      </div>
      <div className="flex flex-row">
        {isDeploymentLive && (
          <div className="flex self-center align-middle">
            <Status status={StatusEnum.Live}>Live</Status>
          </div>
        )}
        <div className="w-28 self-center text-right font-mono text-sm- font-medium">
          <a
            className="font-mono font-medium text-greyscaleDark"
            target="_blank"
            rel="noreferrer"
            href={`https://github.com/${currentApplication.githubRepository?.fullName}/commit/${deployment.commitSHA}`}
          >
            {deployment.commitSHA.substring(0, 7)}
          </a>
        </div>
        <div className="mx-4 w-28 text-right">
          <AppDeploymentDuration
            startedAt={deployment.deploymentStartedAt}
            endedAt={deployment.deploymentEndedAt}
          />
        </div>
        <div className="mx-3 self-center">
          <StatusCircle
            status={deployment.deploymentStatus as DeploymentStatus}
          />
        </div>
        <div className="self-center">
          <Link
            href={`/${currentWorkspace.slug}/${currentApplication.slug}/deployments/${deployment.id}`}
            passHref
          >
            <ChevronRightIcon className="ml-2 h-4 w-4 cursor-pointer self-center" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AppDeployments(props: AppDeploymentsProps) {
  const { appId } = props;
  const [idOfLiveDeployment, setIdOfLiveDeployment] = useState('');

  const router = useRouter();

  // get current page. Default to 1 if not specified
  let page = parseInt(router.query.page as string, 10) || 1;
  page = Math.max(1, page);

  const limit = 10;
  const offset = (page - 1) * limit;

  // @TODO: Should query for all deployments, then subscribe to new ones.

  const { data, loading, error } = useGetDeploymentsSubSubscription({
    variables: {
      id: appId,
      limit,
      offset,
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    if (page === 1) {
      setIdOfLiveDeployment(getLastLiveDeployment(data?.deployments));
    }
  }, [data, idOfLiveDeployment, loading, page]);

  if (loading) {
    return <DelayedLoading delay={500} className="mt-12" />;
  }

  if (error) {
    throw error;
  }

  const nrOfDeployments = data?.deployments?.length || 0;
  const nextAllowed = !(nrOfDeployments < limit);

  return (
    <div className="mt-6">
      {nrOfDeployments === 0 ? (
        <p className="text-sm text-greyscaleGrey">No deployments yet.</p>
      ) : (
        <div>
          <div className="mt-3 divide-y-1 border-t border-b">
            {data?.deployments.map((deployment) => (
              <AppDeploymentRow
                deployment={deployment}
                key={deployment.id}
                isDeploymentLive={idOfLiveDeployment === deployment.id}
              />
            ))}
          </div>
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
