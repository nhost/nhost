import * as DialogPrimitive from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import { Dialog, DialogTitle } from '@/components/ui/v3/dialog';
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

import ProjectViewSkeleton from './ProjectViewSkeleton';

export type ProjectStateGuardVariant = 'paused' | 'pausing' | 'unpausing';

const baseProjectPageRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/';
const overlayPages = new Set(
  [
    'database',
    'database/browser/[dataSourceSlug]',
    'graphql',
    'graphql/remote-schemas',
    'graphql/remote-schemas/[remoteSchemaSlug]',
    'graphql/metadata',
    'events/event-triggers',
    'events/event-triggers/[eventTriggerSlug]',
    'events/cron-triggers',
    'events/cron-triggers/[cronTriggerSlug]',
    'events/one-offs',
    'hasura',
    'auth/users',
    'auth/oauth2-clients',
    'storage',
    'ai/auto-embeddings',
    'ai/assistants',
    'ai/file-stores',
    'metrics',
  ].map((page) => baseProjectPageRoute.concat(page)),
);

const sidebarPages = new Set(
  [
    'events/event-triggers',
    'events/event-triggers/[eventTriggerSlug]',
    'events/cron-triggers',
    'events/cron-triggers/[cronTriggerSlug]',
    'events/one-offs',
    'ai/auto-embeddings',
    'ai/assistants',
    'ai/file-stores',
    'storage',
    'graphql/remote-schemas',
    'graphql/remote-schemas/[remoteSchemaSlug]',
    'database',
    'database/browser/[dataSourceSlug]',
  ].map((page) => baseProjectPageRoute.concat(page)),
);

export default function ProjectStateGuard({
  variant,
  children,
}: PropsWithChildren<{
  variant: ProjectStateGuardVariant;
}>) {
  const { route } = useRouter();
  const { state } = useAppState();

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

  if (!overlayPages.has(route)) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full w-full">
      <ProjectViewSkeleton hasSidebar={sidebarPages.has(route)} />
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

            {variant === 'paused' && (
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
          </DialogPrimitive.Content>
        </div>
      </Dialog>
    </div>
  );
}
