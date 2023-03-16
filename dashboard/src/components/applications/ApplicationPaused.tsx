import ApplicationInfo from '@/components/applications/ApplicationInfo';
import { ChangePlanModal } from '@/components/applications/ChangePlanModal';
import { StagingMetadata } from '@/components/applications/StagingMetadata';
import { useDialog } from '@/components/common/DialogProvider';
import Container from '@/components/layout/Container';
import {
  GetOneUserDocument,
  useGetFreeAndActiveProjectsQuery,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Modal } from '@/ui';
import { Alert } from '@/ui/Alert';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { MAX_FREE_PROJECTS } from '@/utils/CONSTANTS';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { RemoveApplicationModal } from './RemoveApplicationModal';

export default function ApplicationPaused() {
  const { openAlertDialog } = useDialog();
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const [changingApplicationStateLoading, setChangingApplicationStateLoading] =
    useState(false);
  const { id } = useUserData();
  const isOwner = currentWorkspace.members.some(
    ({ userId, type }) => userId === id && type === 'owner',
  );
  const [showDeletingModal, setShowDeletingModal] = useState(false);
  const [unpauseApplication] = useUnpauseApplicationMutation({
    refetchQueries: [GetOneUserDocument],
  });

  const { data, loading } = useGetFreeAndActiveProjectsQuery({
    variables: { userId: id },
    fetchPolicy: 'cache-and-network',
  });

  const numberOfFreeAndLiveProjects = data?.freeAndActiveProjects.length || 0;

  async function handleTriggerUnpausing() {
    setChangingApplicationStateLoading(true);

    try {
      await toast.promise(
        unpauseApplication({ variables: { appId: currentApplication.id } }),
        {
          loading: 'Waking up...',
          success: `${currentApplication.name} has successfully woken up.`,
          error: getServerError(
            `An error occurred while trying to wake up ${currentApplication.name}.`,
          ),
        },
        getToastStyleProps(),
      );
    } catch {
      // Note: The toast will handle the error.
    }

    setChangingApplicationStateLoading(false);
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
          title={`Remove project ${currentApplication.name}?`}
          description={`The project ${currentApplication.name} will be removed. All data will be lost and there will be no way to
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
            {currentApplication.name} is sleeping
          </Text>

          <Text>
            Starter projects stop responding to API calls after 7 days of
            inactivity. Upgarde to Pro to avoid autosleep.
          </Text>
        </Box>

        <Box className="grid grid-flow-row gap-2">
          {currentApplication.plan.isFree && (
            <Button
              className="mx-auto w-full max-w-[280px]"
              onClick={() => {
                openAlertDialog({
                  title: 'Upgrade your plan.',
                  payload: <ChangePlanModal />,
                  props: {
                    PaperProps: { className: 'p-0' },
                    hidePrimaryAction: true,
                    hideSecondaryAction: true,
                    hideTitle: true,
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
              disabled={
                changingApplicationStateLoading ||
                numberOfFreeAndLiveProjects >= MAX_FREE_PROJECTS
              }
              onClick={handleTriggerUnpausing}
            >
              Wake Up
            </Button>

            {numberOfFreeAndLiveProjects >= MAX_FREE_PROJECTS && (
              <Alert severity="warning" className="mx-auto max-w-xs text-left">
                Note: Only one free project can be active at any given time.
                Please pause your active free project before unpausing{' '}
                {currentApplication.name}.
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
