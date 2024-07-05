import { useDialog } from '@/components/common/DialogProvider';
import { Container } from '@/components/layout/Container';
import { Modal } from '@/components/ui/v1/Modal';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { ApplicationInfo } from '@/features/projects/common/components/ApplicationInfo';
import { ApplicationLockedReason } from '@/features/projects/common/components/ApplicationLockedReason';
import { ApplicationPausedReason } from '@/features/projects/common/components/ApplicationPausedReason';
import { ApplicationPausedSymbol } from '@/features/projects/common/components/ApplicationPausedSymbol';
import { ChangePlanModal } from '@/features/projects/common/components/ChangePlanModal';
import { RemoveApplicationModal } from '@/features/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/projects/common/components/StagingMetadata';
import { useAppPausedReason } from '@/features/projects/common/hooks/useAppPausedReason';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import {
  GetAllWorkspacesAndProjectsDocument,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';

export default function ApplicationPaused() {
  const { openDialog } = useDialog();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
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
        await unpauseApplication({ variables: { appId: currentProject.id } });
        await refetchWorkspaceAndProject();
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
          title={`Remove project ${currentProject.name}?`}
          description={`The project ${currentProject.name} will be removed. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
        />
      </Modal>

      <Container className="mx-auto mt-20 grid max-w-lg grid-flow-row gap-6 text-center">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <ApplicationPausedSymbol isLocked={isLocked} />
        </div>

        <Box className="grid grid-flow-row gap-6">
          <Text variant="h3" component="h1">
            {currentProject.name} is {isLocked ? 'locked' : 'sleeping'}
          </Text>
          {!isLocked ? (
            <ApplicationLockedReason reason={lockedReason} />
          ) : (
            <ApplicationPausedReason
              isOwner={isOwner}
              freeAndLiveProjectsNumberExceeded={
                freeAndLiveProjectsNumberExceeded
              }
              projectName={currentProject.name}
              onWakeUpClick={handleTriggerUnpausing}
              onDeleteClick={() => setShowDeletingModal(true)}
              onUpgradeClick={() => {
                openDialog({
                  component: <ChangePlanModal />,
                  props: {
                    PaperProps: { className: 'p-0' },
                    maxWidth: 'lg',
                  },
                });
              }}
              changingApplicationStateLoading={changingApplicationStateLoading}
            />
          )}
        </Box>

        <StagingMetadata>
          <ApplicationInfo />
        </StagingMetadata>
      </Container>
    </>
  );
}
