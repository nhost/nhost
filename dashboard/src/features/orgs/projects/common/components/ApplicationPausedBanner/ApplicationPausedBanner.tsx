import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import { useAppPausedReason } from '@/features/orgs/projects/common/hooks/useAppPausedReason';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';
import { useUnpauseApplicationMutation } from '@/utils/__generated__/graphql';
import Image from 'next/image';
import { useCallback } from 'react';

export default function ApplicationPausedBanner({
  alertClassName,
  textContainerClassName,
  wakeUpButtonClassName,
}: {
  alertClassName?: string;
  textContainerClassName?: string;
  wakeUpButtonClassName?: string;
}) {
  const { org } = useCurrentOrg();
  const { state } = useAppState();
  const { freeAndLiveProjectsNumberExceeded } = useAppPausedReason();
  const { project, refetch: refetchProject } = useProject();

  const [unpauseApplication, { loading: changingApplicationStateLoading }] =
    useUnpauseApplicationMutation({
      variables: {
        appId: project?.id,
      },
    });

  const handleTriggerUnpausing = useCallback(async () => {
    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project.id } });
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage:
          'An error occurred while waking up the project. Please try again.',
      },
    );
  }, [unpauseApplication, project?.id, refetchProject]);

  return (
    <Alert
      severity="warning"
      className={cn(
        'flex w-full flex-col items-start justify-between gap-4 p-4',
        alertClassName,
      )}
    >
      <Image
        src="/assets/PausedApp.svg"
        className="mt-1"
        alt="Closed Eye"
        width={52}
        height={40}
      />

      <div
        className={cn(
          'flex h-full w-full flex-col gap-2',
          textContainerClassName,
        )}
      >
        <p className="w-full">
          Project <b>{project?.name}</b> is paused.
        </p>
        <p className="w-full">
          Wake up your project to make it accessible again. Once reactivated,
          all features will be fully functional. Go to settings to manage your
          project.
        </p>
        {org?.plan?.isFree && (
          <p>
            Projects under your Personal Organization will stop responding to
            API calls after 7 days of inactivity, so consider transferring the
            project to a <b>Pro Organization</b> to avoid auto-sleep.
          </p>
        )}
        {freeAndLiveProjectsNumberExceeded && (
          <p>
            Additionally, only 1 free project can be active at any given time,
            so please pause your current active free project before unpausing
            another.
          </p>
        )}
      </div>
      {state === ApplicationStatus.Paused && (
        <Button
          variant="outline"
          className={cn('w-full', wakeUpButtonClassName)}
          disabled={changingApplicationStateLoading}
          onClick={handleTriggerUnpausing}
        >
          {changingApplicationStateLoading ? <ActivityIndicator /> : 'Wake up'}
        </Button>
      )}
    </Alert>
  );
}
