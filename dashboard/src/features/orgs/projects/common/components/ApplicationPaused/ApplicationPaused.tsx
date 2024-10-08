import { useDialog } from '@/components/common/DialogProvider';
import { Container } from '@/components/layout/Container';
import { Modal } from '@/components/ui/v1/Modal';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { ApplicationLockedReason } from '@/features/orgs/projects/common/components/ApplicationLockedReason';
import { ApplicationPausedReason } from '@/features/orgs/projects/common/components/ApplicationPausedReason';
import { ApplicationPausedSymbol } from '@/features/orgs/projects/common/components/ApplicationPausedSymbol';
import { ChangePlanModal } from '@/features/orgs/projects/common/components/ChangePlanModal';
import { RemoveApplicationModal } from '@/features/orgs/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useAppPausedReason } from '@/features/orgs/projects/common/hooks/useAppPausedReason';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  GetAllWorkspacesAndProjectsDocument,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';

export default function ApplicationPaused() {
  const { openDialog } = useDialog();
  const { project, refetch: refetchProject } = useProject();
  const isOwner = useIsCurrentUserOwner();

  const [showDeletingModal, setShowDeletingModal] = useState(false);
  const [unpauseApplication, { loading: changingApplicationStateLoading }] =
    useUnpauseApplicationMutation({
      refetchQueries: [{ query: GetAllWorkspacesAndProjectsDocument }],
    });

  const { isLocked, lockedReason, freeAndLiveProjectsNumberExceeded, loading } =
    useAppPausedReason();

  async function handleTriggerUnpausing() {
    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project.id } });
        await refetchProject();
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage:
          'An error occurred while waking up the project. Please try again.',
      },
    );
  }

  if (loading) {
    return <ActivityIndicator label="Loading user data..." delay={1000} />;
  }

  return (
    <>
      <Modal
        showModal={showDeletingModal}
        close={() => setShowDeletingModal(false)}
      >
        <RemoveApplicationModal
          close={() => setShowDeletingModal(false)}
          title={`Remove project ${project.name}?`}
          description={`The project ${project.name} will be removed. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
        />
      </Modal>

      <Container className="grid max-w-lg grid-flow-row gap-6 mx-auto mt-20 text-center">
        <div className="flex flex-col mx-auto text-center w-centImage">
          <ApplicationPausedSymbol isLocked={isLocked} />
        </div>

        <Box className="grid grid-flow-row gap-6">
          <Text variant="h3" component="h1">
            {project.name} is {isLocked ? 'locked' : 'paused'}
          </Text>
          {isLocked ? (
            <ApplicationLockedReason reason={lockedReason} />
          ) : (
            <>
              <ApplicationPausedReason
                freeAndLiveProjectsNumberExceeded={
                  freeAndLiveProjectsNumberExceeded
                }
              />
              <div className="grid grid-flow-row gap-4">
                {isOwner && (
                  <Button
                    className="w-full max-w-xs mx-auto"
                    onClick={() => {
                      openDialog({
                        component: <ChangePlanModal />,
                        props: {
                          PaperProps: { className: 'p-0' },
                          maxWidth: 'lg',
                        },
                      });
                    }}
                  >
                    Upgrade to Pro
                  </Button>
                )}
                <Button
                  variant="borderless"
                  className="w-full max-w-xs mx-auto"
                  loading={changingApplicationStateLoading}
                  disabled={
                    changingApplicationStateLoading ||
                    freeAndLiveProjectsNumberExceeded
                  }
                  onClick={handleTriggerUnpausing}
                >
                  Wake Up
                </Button>

                {isOwner && (
                  <Button
                    color="error"
                    variant="outlined"
                    className="w-full max-w-xs mx-auto"
                    onClick={() => setShowDeletingModal(true)}
                  >
                    Delete Project
                  </Button>
                )}
              </div>
            </>
          )}
        </Box>

        <StagingMetadata>
          <ApplicationInfo />
        </StagingMetadata>
      </Container>
    </>
  );
}
