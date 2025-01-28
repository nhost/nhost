import { ContactUs } from '@/components/common/ContactUs';
import { Container } from '@/components/layout/Container';
import { Modal } from '@/components/ui/v1/Modal';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v2/Button';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { Text } from '@/components/ui/v2/Text';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { ApplicationLive } from '@/features/orgs/projects/common/components/ApplicationLive';
import { RemoveApplicationModal } from '@/features/orgs/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import { getPreviousApplicationState } from '@/features/projects/common/utils/getPreviousApplicationState';
import type { ApplicationState } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import {
  useDeleteApplicationMutation,
  useGetApplicationStateQuery,
  useInsertApplicationMutation,
  useUpdateApplicationMutation,
} from '@/utils/__generated__/graphql';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { getApplicationStatusString } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import { useState } from 'react';

export default function ApplicationErrored() {
  const { project, refetch: refetchProject } = useProject();

  const { org } = useCurrentOrg();

  const [changingApplicationStateLoading, setChangingApplicationStateLoading] =
    useState(false);

  const [deleteApplication] = useDeleteApplicationMutation();
  const [updateApplication] = useUpdateApplicationMutation();

  // If we reach this component we already have an application state in the ERRORED
  // state, but we want to query again to double-check that we have the latest state
  // of the application. @GC.
  const { data, loading, error } = useGetApplicationStateQuery({
    variables: { appId: project?.id },
    skip: !project,
  });

  const previousState = data?.app?.appStates
    ? getPreviousApplicationState(data.app.appStates)
    : null;

  const [showRecreateModal, setShowRecreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [insertApp] = useInsertApplicationMutation();
  const currentDate = new Date().getTime();
  const user = useUserData();
  const isOwner = useIsCurrentUserOwner();

  const appCreatedAt = new Date(project?.createdAt).getTime();

  const FIVE_DAYS_IN_MILLISECONDS = 60 * 24 * 60 * 5 * 1000;
  const HALF_DAY_IN_MILLISECONDS = 60 * 12 * 60 * 1000;

  async function recreateApplication() {
    try {
      await deleteApplication({
        variables: {
          appId: project.id,
        },
      });

      triggerToast(`${project?.name} deleted`);
    } catch (e) {
      triggerToast(`Error deleting ${project?.name}`);
      discordAnnounce(`Error deleting app: ${project?.name} (${user.email})`);
      return;
    }
    try {
      await insertApp({
        variables: {
          app: {
            name: project.name,
            slug: project.slug,
            organizationID: org.id,
            regionId: project.region.id,
          },
        },
      });
      discordAnnounce(`Recreating: ${project?.name} (${user.email})`);
      triggerToast(`Recreating ${project?.name} `);
      await refetchProject();
    } catch (e) {
      triggerToast(`Error trying to recreate: ${project?.name}`);
    }
  }

  async function handleTriggerUnpausing() {
    setChangingApplicationStateLoading(true);
    try {
      await updateApplication({
        variables: {
          appId: project?.id,
          app: {
            desiredState: ApplicationStatus.Live,
          },
        },
      });

      triggerToast(`${project?.name} set to awake.`);
    } catch (e) {
      triggerToast(`Error trying to awake ${project?.name}`);
      discordAnnounce(
        `Error trying to awake app: ${project?.name} (${user.email})`,
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

  if (
    previousState === ApplicationStatus.Updating ||
    previousState === ApplicationStatus.Empty
  ) {
    return (
      <ApplicationLive errorMessage="Error deploying the project most likely due to invalid configuration. Please review your project's configuration and logs for more information." />
    );
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
          title={`Recreate project ${project.name}?`}
          description={`The project ${project?.name} will be removed and then re-created. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
        />
      </Modal>

      <Modal
        showModal={showDeleteModal}
        close={() => setShowDeleteModal(false)}
      >
        <RemoveApplicationModal
          close={() => setShowDeleteModal(false)}
          title={`Remove project ${project.name}?`}
          description={`The project ${project?.name} will be removed. All data will be lost and there will be no way to
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
              <ContactUs />
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
