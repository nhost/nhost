import { Container } from '@/components/layout/Container';
import { Modal } from '@/components/ui/v1/Modal';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { ApplicationLockedReason } from '@/features/orgs/projects/common/components/ApplicationLockedReason';
import { ApplicationPausedReason } from '@/features/orgs/projects/common/components/ApplicationPausedReason';
import { ApplicationPausedSymbol } from '@/features/orgs/projects/common/components/ApplicationPausedSymbol';
import { RemoveApplicationModal } from '@/features/orgs/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useAppPausedReason } from '@/features/orgs/projects/common/hooks/useAppPausedReason';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  GetAllWorkspacesAndProjectsDocument,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';

export default function ApplicationPaused() {
  const { org } = useCurrentOrg();
  const { project, refetch: refetchProject } = useProject();
  const isOwner = useIsCurrentUserOwner();
  const [transferProjectDialogOpen, setTransferProjectDialogOpen] =
    useState(false);

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
  }

  if (loading) {
    return <ActivityIndicator label="Loading user data..." delay={1000} />;
  }

  return (
    <>
      <Modal
        showModal={showDeletingModal}
        close={() => setShowDeletingModal(false)}
        className="flex h-screen items-center justify-center"
      >
        <RemoveApplicationModal
          close={() => setShowDeletingModal(false)}
          title={`Remove project ${project.name}?`}
          description={`The project ${project.name} will be removed. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
          className="z-50"
        />
      </Modal>

      <Container className="mx-auto grid max-w-lg grid-flow-row gap-6 text-center">
        <div className="mx-auto flex w-centImage flex-col text-center">
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
                {org && (
                  <>
                    <Button
                      className="mx-auto w-full max-w-xs"
                      onClick={() => setTransferProjectDialogOpen(true)}
                    >
                      Transfer
                    </Button>
                    <TransferProjectDialog
                      open={transferProjectDialogOpen}
                      setOpen={setTransferProjectDialogOpen}
                    />
                  </>
                )}
                <Button
                  variant="borderless"
                  className="mx-auto w-full max-w-xs"
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
                    className="mx-auto w-full max-w-xs"
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
