import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useState } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Dialog, DialogTitle } from '@/components/ui/v3/dialog';
import { Spinner } from '@/components/ui/v3/spinner';
import { useAppPausedReason } from '@/features/orgs/projects/common/hooks/useAppPausedReason';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { PROJECT_WITH_STATE_QUERY_KEY } from '@/features/orgs/projects/hooks/useProjectWithState';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import { useUnpauseApplicationMutation } from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';

import ProjectViewSkeleton from './ProjectViewSkeleton';
import { hasSidebarSkeleton } from './projectStatePages';

function PausedProjectState() {
  const queryClient = useQueryClient();
  const [unpauseRequested, setUnpauseRequested] = useState(false);
  const { freeAndLiveProjectsNumberExceeded } = useAppPausedReason();
  const { project } = useProject();

  const [unpauseApplication, { loading: changingApplicationStateLoading }] =
    useUnpauseApplicationMutation({
      variables: {
        appId: project?.id,
      },
    });

  const handleTriggerUnpausing = useCallback(async () => {
    if (!project?.id || !project.subdomain) {
      return;
    }

    setUnpauseRequested(true);

    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project.id } });
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await queryClient.invalidateQueries({
          queryKey: [PROJECT_WITH_STATE_QUERY_KEY, project.subdomain],
        });
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage: getUnpauseErrorMessage,
        onError: () => setUnpauseRequested(false),
      },
    );
  }, [project?.id, project?.subdomain, queryClient, unpauseApplication]);

  return (
    <>
      <p className="text-center">
        This project is paused. Unpause to make this available.
      </p>
      {freeAndLiveProjectsNumberExceeded && (
        <p className="text-center text-muted-foreground text-sm">
          Only 1 free project can be active at a time. Pause your current active
          free project first.
        </p>
      )}
      <ButtonWithLoading
        variant="outline"
        className="w-full"
        loading={changingApplicationStateLoading || unpauseRequested}
        onClick={handleTriggerUnpausing}
      >
        Wake up
      </ButtonWithLoading>
    </>
  );
}

export default function ProjectStateScreen({
  state,
}: {
  state: ApplicationStatus;
}) {
  const {
    route,
    query: { appSubdomain },
  } = useRouter();

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
              <PausedProjectState key={String(appSubdomain)} />
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
