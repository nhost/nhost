import * as DialogPrimitive from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Dialog, DialogTitle } from '@/components/ui/v3/dialog';
import { Spinner } from '@/components/ui/v3/spinner';
import { useAppPausedReason } from '@/features/orgs/projects/common/hooks/useAppPausedReason';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import {
  GetOrganizationsDocument,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useUserData } from '@/hooks/useUserData';
import { ApplicationStatus } from '@/types/application';
import ProjectViewSkeleton from './ProjectViewSkeleton';
import { hasSidebarSkeleton } from './projectStatePages';

export default function ProjectStateScreen({
  state,
}: {
  state: ApplicationStatus;
}) {
  const { route } = useRouter();

  const { freeAndLiveProjectsNumberExceeded } = useAppPausedReason();
  const { project, refetch: refetchProject } = useProject();
  const userData = useUserData();
  const track = useTrackEvent();

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
        track('Project Resumed');
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage: getUnpauseErrorMessage,
      },
    );
  }, [unpauseApplication, project?.id, refetchProject, track]);

  return (
    <div className="relative h-full w-full bg-background">
      <ProjectViewSkeleton hasSidebar={hasSidebarSkeleton(route)} />
      <Dialog open modal={false}>
        <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-black/30 py-4 backdrop-blur-sm">
          <DialogPrimitive.Content
            onInteractOutside={(e) => e.preventDefault()}
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-background p-6 shadow-lg"
          >
            <DialogTitle className="sr-only">Project State</DialogTitle>

            <Image
              src="/assets/PausedApp.svg"
              alt="Paused project"
              width={52}
              height={40}
            />

            {state === ApplicationStatus.Paused && (
              <>
                <p className="text-center">
                  This project is paused. Unpause to make this available.
                </p>
                {freeAndLiveProjectsNumberExceeded && (
                  <p className="text-center text-muted-foreground text-sm">
                    Only 1 free project can be active at a time. Pause your
                    current active free project first.
                  </p>
                )}
                <ButtonWithLoading
                  variant="outline"
                  className="w-full"
                  loading={changingApplicationStateLoading}
                  onClick={handleTriggerUnpausing}
                >
                  Wake up
                </ButtonWithLoading>
              </>
            )}

            {state === ApplicationStatus.Pausing && (
              <p className="flex items-center gap-2 text-center">
                <Spinner size="xs" />
                Project is pausing...
              </p>
            )}

            {state === ApplicationStatus.Unpausing && (
              <>
                <p className="flex items-center gap-2 text-center">
                  <Spinner size="xs" />
                  Project is waking up...
                </p>
                <p className="text-center text-muted-foreground text-sm">
                  This may take a couple of minutes.
                </p>
              </>
            )}

            {state === ApplicationStatus.Restoring && (
              <>
                <p className="flex items-center gap-2 text-center">
                  <Spinner size="xs" />
                  Project is restoring...
                </p>
                <p className="text-center text-muted-foreground text-sm">
                  This may take a couple of minutes.
                </p>
              </>
            )}
          </DialogPrimitive.Content>
        </div>
      </Dialog>
    </div>
  );
}
