import type { ApolloError } from '@apollo/client';
import { InfoIcon, RefreshCwIcon, TriangleAlert } from 'lucide-react';
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
import { getToastStyleProps } from '@/utils/constants/settings';
import BaseErrorToast from './BaseErrorToast';

function getConflictMessage({
  isFetchDisabled,
  hasFetchError,
}: {
  isFetchDisabled: boolean;
  hasFetchError: boolean;
}): string {
  if (isFetchDisabled) {
    return 'Fetching metadata is unavailable here. Open the project and reload the page to fetch its metadata.';
  }

  if (hasFetchError) {
    return 'Try again. If the problem persists, reload the page.';
  }

  return 'To save your changes, fetch the latest metadata, review your changes, then try again.';
}

export interface MetadataConflictToastProps {
  toastId: string;
  error: ApolloError | Error;
}

export default function MetadataConflictToast({
  toastId,
  error,
}: MetadataConflictToastProps) {
  const { loading: loadingProject } = useProject();
  const adminApi = useAdminApiTarget();
  const { refetch, isFetching, isError } = useExportMetadata((data) => data, {
    enabled: false,
  });

  const isFetchDisabled = loadingProject || !adminApi;
  const hasFetchError = !isFetchDisabled && isError;
  const fetchLabel = hasFetchError ? 'Try again' : 'Fetch metadata';

  const fetchMetadata = async () => {
    const { isSuccess } = await refetch();

    if (isSuccess) {
      const toastStyle = getToastStyleProps();

      toast.dismiss(toastId);
      toast.success('Metadata fetched successfully.', {
        style: toastStyle.style,
        ...toastStyle.success,
      });
    }
  };

  return (
    <BaseErrorToast
      toastId={toastId}
      error={error}
      footer={
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
            onClick={fetchMetadata}
            loading={isFetching}
            loaderClassName="h-4 w-4"
            disabled={isFetchDisabled}
          >
            {!isFetching && (
              <RefreshCwIcon aria-hidden="true" className="mr-2 h-4 w-4" />
            )}
            {isFetching ? 'Fetching metadata…' : fetchLabel}
          </ButtonWithLoading>
        </div>
      }
    >
      <div className="min-w-0 flex-grow space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">
            {hasFetchError
              ? 'Couldn’t fetch metadata'
              : 'Metadata is out of date'}
          </h3>
          {!hasFetchError && (
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
                The metadata on the server is newer than the metadata currently
                loaded in the dashboard.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-sm text-white/80">
          {getConflictMessage({ isFetchDisabled, hasFetchError })}
        </p>
      </div>
    </BaseErrorToast>
  );
}
