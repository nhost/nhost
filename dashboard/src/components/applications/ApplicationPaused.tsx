import ApplicationInfo from '@/components/applications/ApplicationInfo';
import { ChangePlanModal } from '@/components/applications/ChangePlanModal';
import { StagingMetadata } from '@/components/applications/StagingMetadata';
import { useDialog } from '@/components/common/DialogProvider';
import Container from '@/components/layout/Container';
import { useUpdateApplicationMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { ApplicationStatus } from '@/types/application';
import { Modal } from '@/ui';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import { useState } from 'react';
import { RemoveApplicationModal } from './RemoveApplicationModal';

export default function ApplicationPaused() {
  const { openAlertDialog } = useDialog();
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const [changingApplicationStateLoading, setChangingApplicationStateLoading] =
    useState(false);
  const [updateApplication, { client }] = useUpdateApplicationMutation();
  const { id, email } = useUserData();
  const isOwner = currentWorkspace.members.some(
    ({ userId, type }) => userId === id && type === 'owner',
  );
  const isPro = currentApplication.plan.name === 'Pro';
  const [showDeletingModal, setShowDeletingModal] = useState(false);

  async function handleTriggerUnpausing() {
    setChangingApplicationStateLoading(true);
    try {
      await updateApplication({
        variables: {
          appId: currentApplication.id,
          app: {
            desiredState: ApplicationStatus.Live,
          },
        },
      });
      await updateOwnCache(client);
      discordAnnounce(
        `App ${currentApplication.name} (${email}) set to awake.`,
      );
      triggerToast(`${currentApplication.name} set to awake.`);
    } catch (e) {
      triggerToast(`Error trying to awake ${currentApplication.name}`);
    }
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

      <Container className="mx-auto mt-20 grid max-w-sm grid-flow-row gap-2 text-center">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <Image
            src="/assets/PausedApp.svg"
            alt="Closed Eye"
            width={72}
            height={72}
          />
        </div>

        <Text variant="h3" component="h1" className="mt-4">
          {currentApplication.name} is sleeping
        </Text>

        <Text className="mt-1">
          Projects on the free plan stop responding to API calls after 7 days of
          no traffic.
        </Text>

        {!isPro && (
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
            Upgrade to Pro to avoid autosleep
          </Button>
        )}

        <div className="grid grid-flow-row gap-2">
          <Button
            variant="borderless"
            className="mx-auto w-full max-w-[280px]"
            loading={changingApplicationStateLoading}
            disabled={changingApplicationStateLoading}
            onClick={handleTriggerUnpausing}
          >
            Wake Up
          </Button>

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
        <StagingMetadata>
          <ApplicationInfo />
        </StagingMetadata>
      </Container>
    </>
  );
}
