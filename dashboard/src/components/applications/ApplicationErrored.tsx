import FeedbackForm from '@/components/common/FeedbackForm';
import Container from '@/components/layout/Container';
import { useAppCreatedAt } from '@/hooks/useAppCreatedAt';
import { useCurrentDate } from '@/hooks/useCurrentDate';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import type { ApplicationState } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import { Modal } from '@/ui/Modal';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import { Dropdown } from '@/ui/v2/Dropdown';
import Text from '@/ui/v2/Text';
import {
  useDeleteApplicationMutation,
  useGetApplicationStateQuery,
  useInsertApplicationMutation,
  useUpdateApplicationMutation,
} from '@/utils/__generated__/graphql';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { getPreviousApplicationState } from '@/utils/getPreviousApplicationState';
import { getApplicationStatusString } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useApolloClient } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import ApplicationInfo from './ApplicationInfo';
import ApplicationLive from './ApplicationLive';
import ApplicationUnknown from './ApplicationUnknown';
import { RemoveApplicationModal } from './RemoveApplicationModal';
import { StagingMetadata } from './StagingMetadata';

export default function ApplicationErrored() {
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const [changingApplicationStateLoading, setChangingApplicationStateLoading] =
    useState(false);

  const [deleteApplication] = useDeleteApplicationMutation();
  const [updateApplication] = useUpdateApplicationMutation();

  // If we reach this component we already have an application state in the ERRORED
  // state, but we want to query again to double-check that we have the latest state
  // of the application. @GC.
  const { data, loading, error } = useGetApplicationStateQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
  });

  const [previousState, setPreviousState] = useState<ApplicationStatus | null>(
    null,
  );

  const [showRecreateModal, setShowRecreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [insertApp] = useInsertApplicationMutation();
  const client = useApolloClient();
  const { currentDate } = useCurrentDate();
  const user = useUserData();
  const isOwner = currentWorkspace.workspaceMembers.some(
    ({ id, type }) => id === user?.id && type === 'owner',
  );

  const { appCreatedAt } = useAppCreatedAt();

  const FIVE_DAYS_IN_MILLISECONDS = 60 * 24 * 60 * 5 * 1000;
  const HALF_DAY_IN_MILLISECONDS = 60 * 12 * 60 * 1000;

  async function recreateApplication() {
    try {
      await deleteApplication({
        variables: {
          appId: currentProject.id,
        },
      });

      triggerToast(`${currentProject?.name} deleted`);
    } catch (e) {
      triggerToast(`Error deleting ${currentProject?.name}`);
      discordAnnounce(
        `Error deleting app: ${currentProject?.name} (${user.email})`,
      );
      return;
    }
    try {
      await insertApp({
        variables: {
          app: {
            name: currentProject.name,
            slug: currentProject.slug,
            planId: currentProject.plan.id,
            workspaceId: currentWorkspace.id,
            regionId: currentProject.region.id,
          },
        },
      });
      discordAnnounce(`Recreating: ${currentProject?.name} (${user.email})`);
      triggerToast(`Recreating ${currentProject?.name} `);
      await updateOwnCache(client);
    } catch (e) {
      triggerToast(`Error trying to recreate: ${currentProject?.name}`);
    }
  }

  async function handleTriggerUnpausing() {
    setChangingApplicationStateLoading(true);
    try {
      await updateApplication({
        variables: {
          appId: currentProject?.id,
          app: {
            desiredState: ApplicationStatus.Live,
          },
        },
      });

      triggerToast(`${currentProject?.name} set to awake.`);
    } catch (e) {
      triggerToast(`Error trying to awake ${currentProject?.name}`);
      discordAnnounce(
        `Error trying to awake app: ${currentProject?.name} (${user.email})`,
      );
    }
  }

  async function handleTryAgain() {
    setChangingApplicationStateLoading(true);

    // If the application is older than seven days, and has fallen into failed setup, we want
    // to make sure the user knows that attempting to recreate the application will remove
    // all of its data.
    if (currentDate - appCreatedAt > HALF_DAY_IN_MILLISECONDS) {
      setChangingApplicationStateLoading(false);
      setShowRecreateModal(true);
      // Since the modal for removing an application already handles the deleting of the app,
      // we don't want to delete it on the recreation part but just insert the same app with the same
      // data.
      return;
    }
    await recreateApplication();
  }

  useEffect(() => {
    if (loading) {
      return;
    }
    if (error) {
      return;
    }

    const previousAcceptedState = getPreviousApplicationState(
      data.app.appStates,
    );
    setPreviousState(previousAcceptedState);
  }, [setPreviousState, data, loading, error]);

  if (loading || previousState === null) {
    return (
      <Container className="mx-auto mt-12 max-w-sm text-center">
        <ActivityIndicator
          delay={500}
          label="Loading application state..."
          className="mx-auto inline-grid"
        />
      </Container>
    );
  }

  if (error) {
    return null;
  }

  if (previousState === ApplicationStatus.Live) {
    return <ApplicationLive />;
  }

  // For now, if the application errored and the previous state to this error is an UPDATING state, we want to show the dashboard,
  // it's likely that most services are up and we shouldn't block all functionality. In the future, we're going to have a way to
  // redeploy the app again, and get to a healthy state. @GC
  if (previousState === ApplicationStatus.Updating) {
    return <ApplicationLive />;
  }

  if (previousState === ApplicationStatus.Empty) {
    return <ApplicationUnknown />;
  }

  return (
    <>
      <Modal
        showModal={showRecreateModal}
        close={() => setShowRecreateModal(false)}
      >
        <RemoveApplicationModal
          // We accept a handler in this model to override the function of then modal,
          // which instead of deleting just an application, it deletes and recreates.
          handler={recreateApplication}
          close={() => setShowRecreateModal(false)}
          title={`Recreate project ${currentProject.name}?`}
          description={`The project ${currentProject?.name} will be removed and then re-created. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
        />
      </Modal>

      <Modal
        showModal={showDeleteModal}
        close={() => setShowDeleteModal(false)}
      >
        <RemoveApplicationModal
          close={() => setShowDeleteModal(false)}
          title={`Remove project ${currentProject.name}?`}
          description={`The project ${currentProject?.name} will be removed. All data will be lost and there will be no way to
        recover the app once it has been deleted.`}
        />
      </Modal>

      <Container className="mx-auto mt-12 max-w-sm text-center">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <Image
            src="/assets/ProvisioningFailed.svg"
            alt="Danger sign"
            width={72}
            height={72}
          />
        </div>
        <Text variant="h3" component="h1" className="mt-4">
          Project Setup Failed while {getApplicationStatusString(previousState)}
        </Text>

        <Text className="mt-1 font-normal">
          Something on our end went wrong and we could not finish setup. If this
          keeps happening, contact support.
        </Text>

        <div className="mx-auto mt-6 grid grid-flow-row gap-2">
          {(previousState === ApplicationStatus.Provisioning ||
            previousState === ApplicationStatus.Unpausing) &&
          currentDate - appCreatedAt < FIVE_DAYS_IN_MILLISECONDS ? (
            <Button
              className="mx-auto w-full max-w-[240px]"
              loading={changingApplicationStateLoading}
              onClick={() => {
                const previousApplicationState = getPreviousApplicationState(
                  data.app.appStates as ApplicationState[],
                );

                switch (previousApplicationState) {
                  case ApplicationStatus.Provisioning:
                    handleTryAgain();
                    break;
                  case ApplicationStatus.Unpausing:
                    handleTriggerUnpausing();
                    break;
                  default:
                    throw new Error(`Unrecognized previous project state.`);
                }
              }}
            >
              Try Again
            </Button>
          ) : null}

          <Dropdown.Root>
            <Dropdown.Trigger
              className="w-full max-w-[240px]"
              hideChevron
              asChild
            >
              <Button variant="borderless">Contact Support</Button>
            </Dropdown.Trigger>

            <Dropdown.Content
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              <FeedbackForm />
            </Dropdown.Content>
          </Dropdown.Root>

          {isOwner && (
            <Button
              variant="borderless"
              color="error"
              className="mx-auto w-full max-w-[240px]"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Project
            </Button>
          )}
        </div>

        <StagingMetadata>
          <ApplicationInfo />
        </StagingMetadata>
      </Container>
    </>
  );
}
