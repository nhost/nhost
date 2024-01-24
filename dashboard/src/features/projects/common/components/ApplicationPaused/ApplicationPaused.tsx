import { useDialog } from '@/components/common/DialogProvider';
import { Container } from '@/components/layout/Container';
import { Modal } from '@/components/ui/v1/Modal';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { ApplicationInfo } from '@/features/projects/common/components/ApplicationInfo';
import { ChangePlanModal } from '@/features/projects/common/components/ChangePlanModal';
import { RemoveApplicationModal } from '@/features/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/projects/common/components/StagingMetadata';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import {
  GetAllWorkspacesAndProjectsDocument,
  useGetFreeAndActiveProjectsQuery,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { MAX_FREE_PROJECTS } from '@/utils/constants/common';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import { useState } from 'react';

export default function ApplicationPaused() {
  const { openDialog } = useDialog();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const isOwner = useIsCurrentUserOwner();
  const user = useUserData();

  const [showDeletingModal, setShowDeletingModal] = useState(false);
  const [unpauseApplication, { loading: changingApplicationStateLoading }] =
    useUnpauseApplicationMutation({
      refetchQueries: [{ query: GetAllWorkspacesAndProjectsDocument }],
    });

  const { data, loading } = useGetFreeAndActiveProjectsQuery({
    variables: { userId: user?.id },
    skip: !user,
  });

  const numberOfFreeAndLiveProjects = data?.freeAndActiveProjects.length || 0;
  const wakeUpDisabled = numberOfFreeAndLiveProjects >= MAX_FREE_PROJECTS;

  async function handleTriggerUnpausing() {
    await execPromiseWithErrorToast(
      async () => {
        unpauseApplication({ variables: { appId: currentProject.id } });
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

      <Container className="mx-auto mt-20 grid max-w-lg grid-flow-row gap-4 text-center">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <Image
            src="/assets/PausedApp.svg"
            alt="Closed Eye"
            width={72}
            height={72}
          />
        </div>

        <Box className="grid grid-flow-row gap-1">
          <Text variant="h3" component="h1">
            {currentProject.name} is sleeping
          </Text>

          <Text>
            Starter projects stop responding to API calls after 7 days of
            inactivity. Upgrade to Pro to avoid autosleep.
          </Text>
        </Box>

        <Box className="grid grid-flow-row gap-2">
          {isOwner && (
            <Button
              className="mx-auto w-full max-w-[280px]"
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

          <div className="grid grid-flow-row gap-2">
            <Button
              variant="borderless"
              className="mx-auto w-full max-w-[280px]"
              loading={changingApplicationStateLoading}
              disabled={changingApplicationStateLoading || wakeUpDisabled}
              onClick={handleTriggerUnpausing}
            >
              Wake Up
            </Button>

            {wakeUpDisabled && (
              <Alert severity="warning" className="mx-auto max-w-xs text-left">
                Note: Only one free project can be active at any given time.
                Please pause your active free project before unpausing{' '}
                {currentProject.name}.
              </Alert>
            )}

            {isOwner && (
              <Button
                color="error"
                variant="borderless"
                className="mx-auto w-full max-w-[280px]"
                onClick={() => setShowDeletingModal(true)}
              >
                Delete Project
              </Button>
            )}
          </div>
        </Box>

        <StagingMetadata>
          <ApplicationInfo />
        </StagingMetadata>
      </Container>
    </>
  );
}
