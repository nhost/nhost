import type { ApolloError } from '@apollo/client';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  InfoIcon,
  RefreshCwIcon,
  TriangleAlert,
  XIcon,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useUserData } from '@/hooks/useUserData';
import { cn } from '@/lib/utils';
import { copy } from '@/utils/copy';

interface ErrorDetails {
  info: {
    projectId: string;
    userId: string;
    url?: string;
  };
  error: ApolloError | Error | object;
}

const errorToObject = (error: ApolloError | Error) => {
  if (error.name === 'ApolloError') {
    return error;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {};
};

export default function ErrorToast({
  toastId,
  errorMessage,
  error,
}: {
  toastId: string;
  errorMessage: string;
  error: ApolloError | Error;
}) {
  const userData = useUserData();
  const { asPath } = useRouter();

  const [showInfo, setShowInfo] = useState(false);
  const { project, loading } = useProject();
  const adminApi = useAdminApiTarget();
  const [recoveryProject] = useState(() => ({
    id: project?.id,
    subdomain: project?.subdomain,
  }));
  const [refreshState, setRefreshState] = useState<
    'idle' | 'refreshing' | 'error'
  >('idle');
  const { refetch } = useExportMetadata((data) => data, {
    enabled: false,
  });

  // ponytail: callers discard Hasura error codes; match this message until errors retain structured codes.
  const isMetadataConflict =
    error instanceof Error &&
    /^metadata resource version referenced \(\d+\) did not match current version$/.test(
      error.message,
    );
  const canRefresh = !!(
    recoveryProject.id &&
    recoveryProject.subdomain &&
    recoveryProject.id === project?.id &&
    recoveryProject.subdomain === project?.subdomain &&
    project?.region &&
    adminApi &&
    !loading
  );
  const isRefreshing = refreshState === 'refreshing';
  const hasRefreshError = canRefresh && refreshState === 'error';
  const refreshLabel = hasRefreshError ? 'Try again' : 'Fetch metadata';

  let message =
    errorMessage || 'An unknown error has occurred, please try again later!';
  if (isMetadataConflict) {
    message =
      'To save your changes, fetch the latest metadata, review your changes, then try again.';
    if (!canRefresh) {
      message =
        'Fetching metadata is unavailable here. Open the original project and reload the page to fetch its metadata.';
    } else if (refreshState === 'error') {
      message = 'Try again. If the problem persists, reload the page.';
    }
  }

  const refreshMetadata = async () => {
    if (!isMetadataConflict || !canRefresh || isRefreshing) {
      return;
    }

    setRefreshState('refreshing');
    try {
      await refetch({ throwOnError: true });
      toast.dismiss(toastId);
    } catch {
      setRefreshState('error');
    }
  };

  const errorDetails: ErrorDetails = {
    info: {
      projectId: project?.id,
      userId: userData?.id || 'local',
      url: asPath,
    },
    error: errorToObject(error),
  };

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg text-white">
      <div
        className={cn(
          'flex flex-row items-center justify-between gap-4',
          isMetadataConflict && 'items-start',
        )}
      >
        <button
          className={cn('flex-shrink-0', isMetadataConflict && 'mt-1')}
          onClick={() => toast.dismiss(toastId)}
          type="button"
          aria-label="Close"
        >
          <XIcon className="h-4 w-4 text-white" />
        </button>
        {isMetadataConflict ? (
          <div className="min-w-0 flex-grow space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                {hasRefreshError
                  ? 'Couldn’t fetch metadata'
                  : 'Metadata is out of date'}
              </h3>
              {!hasRefreshError && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About metadata versions"
                      className="inline-flex shrink-0 text-white/70 hover:text-white focus-visible:text-white"
                    >
                      <InfoIcon aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="z-[10002] max-w-xs">
                    The metadata on the server is newer than the metadata
                    currently loaded in the dashboard.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-sm text-white/80">{message}</p>
          </div>
        ) : (
          <span className="flex-grow overflow-hidden whitespace-normal break-words">
            {message}
          </span>
        )}

        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="flex flex-shrink-0 flex-row items-center justify-center space-x-2 text-white"
          aria-label="Show error details"
        >
          <span>Info</span>
          {showInfo ? (
            <ChevronUpIcon className="h-3 w-3 text-white" />
          ) : (
            <ChevronDownIcon className="h-3 w-3 text-white" />
          )}
        </button>
      </div>

      {showInfo && (
        <div className="flex flex-col space-y-4">
          <div className="relative flex flex-col">
            <div className="relative flex max-h-[400px] w-full flex-row justify-between overflow-x-auto rounded-lg bg-black p-4">
              <pre>{JSON.stringify(errorDetails, null, 2)}</pre>
            </div>
            <button
              type="button"
              aria-label="Copy error details"
              className="absolute top-2 right-2"
              onClick={(event) => {
                event.stopPropagation();
                copy(JSON.stringify(errorDetails, null, 2), 'Error details');
              }}
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isMetadataConflict && (
        <div className="flex items-center justify-between gap-3 border-white/20 border-t pt-3">
          <p className="flex items-center gap-2 text-white/80 text-xs">
            <TriangleAlert
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 text-amber-500"
            />
            Unsaved form changes may be reset
          </p>
          <ButtonWithLoading
            variant="default"
            className="ml-auto shrink-0"
            onClick={refreshMetadata}
            loading={isRefreshing}
            loaderClassName="h-4 w-4"
            disabled={!canRefresh}
          >
            {!isRefreshing && (
              <RefreshCwIcon aria-hidden="true" className="mr-2 h-4 w-4" />
            )}
            {isRefreshing ? 'Fetching metadata…' : refreshLabel}
          </ButtonWithLoading>
        </div>
      )}
    </div>
  );
}
