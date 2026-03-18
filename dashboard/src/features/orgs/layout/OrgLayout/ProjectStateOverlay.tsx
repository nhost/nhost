import { X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import { useAppPausedReason } from '@/features/orgs/projects/common/hooks/useAppPausedReason';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUserData } from '@/hooks/useUserData';
import { ApplicationStatus } from '@/types/application';
import {
  GetOrganizationsDocument,
  useUnpauseApplicationMutation,
} from '@/utils/__generated__/graphql';

export type ProjectStateOverlayVariant = 'paused' | 'pausing' | 'unpausing';

export default function ProjectStateOverlay({
  variant,
}: {
  variant: ProjectStateOverlayVariant;
}) {
  const { route } = useRouter();
  const [lastRoute, setLastRoute] = useState(route);
  const [dismissed, setDismissed] = useState(false);
  const { state } = useAppState();

  if (route !== lastRoute) {
    setLastRoute(route);
    setDismissed(false);
  }
  const { freeAndLiveProjectsNumberExceeded } = useAppPausedReason();
  const { project, refetch: refetchProject } = useProject();
  const userData = useUserData();

  const [unpauseApplication, { loading: changingApplicationStateLoading }] =
    useUnpauseApplicationMutation({
      variables: {
        appId: project?.id,
      },
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

  const handleTriggerUnpausing = useCallback(async () => {
    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project?.id } });
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

  if (dismissed) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Dismiss overlay"
      className="absolute inset-0 z-20 grid cursor-default place-items-center bg-black/30 backdrop-blur-sm"
      onClick={() => setDismissed(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setDismissed(true);
        }
      }}
    >
      <div
        role="dialog"
        className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <Image
          src="/assets/PausedApp.svg"
          alt="Paused project"
          width={52}
          height={40}
        />

        {variant === 'paused' && (
          <>
            <p className="text-center">
              This project is paused. Unpause to make this available.
            </p>
            {freeAndLiveProjectsNumberExceeded && (
              <p className="text-center text-muted-foreground text-sm">
                Only 1 free project can be active at a time. Pause your current
                active free project first.
              </p>
            )}
            {state === ApplicationStatus.Paused && (
              <Button
                variant="outline"
                className="w-full"
                disabled={changingApplicationStateLoading}
                onClick={handleTriggerUnpausing}
              >
                {changingApplicationStateLoading ? (
                  <ActivityIndicator />
                ) : (
                  'Wake up'
                )}
              </Button>
            )}
          </>
        )}

        {variant === 'pausing' && (
          <p className="flex items-center gap-2 text-center">
            <ActivityIndicator />
            Project is pausing...
          </p>
        )}

        {variant === 'unpausing' && (
          <>
            <p className="flex items-center gap-2 text-center">
              <ActivityIndicator />
              Project is waking up...
            </p>
            <p className="text-center text-muted-foreground text-sm">
              This may take a couple of minutes.
            </p>
          </>
        )}
      </div>
    </button>
  );
}
