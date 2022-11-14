import { useDialog } from '@/components/common/DialogProvider';
import features from '@/data/features.json';
import {
  useGetWorkspaceMembersQuery,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { ApplicationStatus } from '@/types/application';
import { Modal } from '@/ui';
import Status, { StatusEnum } from '@/ui/Status';
import Button from '@/ui/v2/Button';
import { Dropdown } from '@/ui/v2/Dropdown';
import ChevronDownIcon from '@/ui/v2/icons/ChevronDownIcon';
import Tooltip from '@/ui/v2/Tooltip';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { getCurrentEnvironment, isDevOrStaging } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useUserData } from '@nhost/react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { ChangeApplicationName } from './ChangeApplicationName';
import ResetDatabasePasswordForm from './overview/ResetDatabasePasswordForm';
import { RemoveApplicationModal } from './RemoveApplicationModal';

const isK8SPostgresEnabledInCurrentEnvironment = features[
  'k8s-postgres'
].enabled.find((e) => e === getCurrentEnvironment());

export function ApplicationMenuItems() {
  const { currentApplication, currentWorkspace } =
    useCurrentWorkspaceAndApplication();
  const [updateApplication, { client }] = useUpdateApplicationMutation();
  const { openAlertDialog } = useDialog();
  const user = useUserData();
  const [changeApplicationNameModal, setChangeApplicationNameModal] =
    useState(false);
  const [deleteApplicationModal, setDeleteApplicationModal] = useState(false);

  const isProjectUsingRDS = currentApplication?.featureFlags?.find(
    (feature) => feature.name === 'fleetcontrol_use_rds',
  );

  async function handleTriggerPausing() {
    try {
      await updateApplication({
        variables: {
          appId: currentApplication.id,
          app: {
            desiredState: ApplicationStatus.Paused,
          },
        },
      });
      await updateOwnCache(client);
      discordAnnounce(`${currentApplication.name} set to pause.`);
      triggerToast(`${currentApplication.name} set to pause.`);
    } catch (e) {
      triggerToast(`Error trying to pause ${currentApplication.name}`);
    }
  }

  const { data: workspaceData, loading } = useGetWorkspaceMembersQuery({
    variables: { workspaceId: currentWorkspace.id },
    fetchPolicy: 'cache-first',
  });

  if (loading) {
    return null;
  }

  const isOwner = workspaceData.workspace.workspaceMembers.some(
    (member) => member.user.id === user.id && member.type === 'owner',
  );

  return (
    <>
      <Modal
        showModal={changeApplicationNameModal}
        close={() => setChangeApplicationNameModal(!changeApplicationNameModal)}
        Component={ChangeApplicationName}
      />
      <Modal
        showModal={deleteApplicationModal}
        close={() => setDeleteApplicationModal(!deleteApplicationModal)}
        Component={RemoveApplicationModal}
      />
      <Dropdown.Root>
        <Dropdown.Trigger asChild hideChevron>
          <Button
            endIcon={<ChevronDownIcon className="h-4 w-4" />}
            variant="outlined"
            color="secondary"
          >
            Project Settings
          </Button>
        </Dropdown.Trigger>

        <Dropdown.Content
          menu
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          className="mt-1"
        >
          <Dropdown.Item
            className="font-display text-sm font-medium text-dark"
            onClick={() => setChangeApplicationNameModal(true)}
          >
            Change Project Name
          </Dropdown.Item>
          {isDevOrStaging() && (
            <Dropdown.Item
              className="font-display text-sm font-medium text-dark"
              onClick={handleTriggerPausing}
            >
              <Status status={StatusEnum.Deploying}>Internal</Status>
              <span className="ml-2 align-middle">Pause App</span>
            </Dropdown.Item>
          )}
          {isK8SPostgresEnabledInCurrentEnvironment && !isProjectUsingRDS && (
            <Dropdown.Item
              className="font-display text-sm font-medium text-dark"
              onClick={() => {
                openAlertDialog({
                  title: 'Reset Database Password',
                  payload: <ResetDatabasePasswordForm />,
                  props: {
                    hidePrimaryAction: true,
                    hideSecondaryAction: true,
                  },
                });
              }}
            >
              Reset Database Password
            </Dropdown.Item>
          )}

          <Tooltip
            title="Only owners of the workspace can delete apps"
            visible={!isOwner}
            hasDisabledChildren={!isOwner}
          >
            <Dropdown.Item
              className={twMerge(
                'font-display text-sm font-medium text-dark',
                !isOwner
                  ? 'cursor-not-allowed text-red text-opacity-70'
                  : 'font-medium text-red',
              )}
              onClick={() => setDeleteApplicationModal(true)}
              disabled={!isOwner}
            >
              <span>Delete Project</span>
            </Dropdown.Item>
          </Tooltip>
        </Dropdown.Content>
      </Dropdown.Root>
    </>
  );
}

export default ApplicationMenuItems;
