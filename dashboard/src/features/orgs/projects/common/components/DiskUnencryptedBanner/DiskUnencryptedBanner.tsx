import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';
import { useUnpauseApplicationMutation } from '@/utils/__generated__/graphql';
import Image from 'next/image';
import { useCallback } from 'react';

export default function DiskUnencryptedBanner({
  alertClassName,
  textContainerClassName,
  wakeUpButtonClassName,
}: {
  alertClassName?: string;
  textContainerClassName?: string;
  wakeUpButtonClassName?: string;
}) {
  const { state } = useAppState();
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
        src="/assets/key.svg"
        className="mt-1"
        alt="Key"
        width={52}
        height={40}
      />

      <div
        className={cn(
          'flex h-full w-full flex-col gap-2',
          textContainerClassName,
        )}
      >
        <p className="w-full">Disk encryption is now available!</p>
        <p className="w-full">
          To enable encryption in this project all you have to do is pause &
          unpause it.
        </p>
      </div>
      {state === ApplicationStatus.Live && (
        <Button
          variant="outline"
          className={cn('w-full', wakeUpButtonClassName)}
          disabled={changingApplicationStateLoading}
          onClick={handleTriggerUnpausing}
        >
          {changingApplicationStateLoading ? <ActivityIndicator /> : 'Pause'}
        </Button>
      )}
    </Alert>
  );
}
