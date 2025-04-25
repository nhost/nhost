import { Button } from '@/components/ui/v3/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { type FinishOrgCreationOnCompletedCb } from '@/features/orgs/hooks/useFinishOrgCreation/useFinishOrgCreation';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { analytics } from '@/lib/segment';
import { isEmptyValue } from '@/lib/utils';
import { useBillingTransferAppMutation } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { memo } from 'react';
import FinishOrgCreation from './FinishOrgCreation';

interface Props {
  onCreateOrgError: () => void;
  onCancel: () => void;
  onCreateNewOrg: () => void;
}

function UpgradeProjectDialogContent({
  onCreateNewOrg,
  onCancel,
  onCreateOrgError,
}: Props) {
  const [transferProjectMutation] = useBillingTransferAppMutation();
  const { project } = useProject();
  const { refetch: refetchOrgs } = useOrgs();
  const { push, query } = useRouter();
  const { session_id } = query;

  const showContent = isEmptyValue(session_id);
  async function transferProject(newOrgSlug: string) {
    const { data } = await refetchOrgs();
    const newOrg = data.organizations.find((org) => org.slug === newOrgSlug);
    await execPromiseWithErrorToast(
      async () => {
        await transferProjectMutation({
          variables: {
            appID: project?.id,
            organizationID: newOrg?.id,
          },
        });

        analytics.track('Project Upgraded', {
          projectId: project?.id,
          projectName: project?.name,
          projectSubdomain: project?.subdomain,
          newOrganizationId: newOrg?.id,
          newOrganizationName: newOrg?.name,
          newOrganizationSlug: newOrg?.slug,
          newOrganizationPlan: newOrg?.plan?.name,
          newOrganizationPlanId: newOrg?.plan?.id,
        });

        await push(`/orgs/${newOrg?.slug}/projects`);
      },
      {
        loadingMessage: 'Upgrading project...',
        successMessage: 'Project has been upgraded successfully!',
        errorMessage: 'Error upgrading project. Please try again.',
      },
    );
  }

  const handleOnCompleted: FinishOrgCreationOnCompletedCb = async (data) => {
    await transferProject(data.Slug);
  };

  return (
    <>
      <DialogHeader className="flex gap-2">
        <DialogTitle>Upgrade project</DialogTitle>
      </DialogHeader>

      {showContent ? (
        <>
          <DialogDescription className="text-base">
            <span className="mb-4 block">
              To access premium features from a paid plan, a project must belong
              to an organization on that plan.
            </span>
            <span className="mb-4 block">
              Continue to create a new organization with a subscription plan.
              Your project will be automatically transferred to the new
              organization, unlocking all paid features.
            </span>
            <span className="block">
              Alternatively, you can transfer your project to an existing paid
              organization in your project&apos;s settings.
            </span>
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" onClick={onCreateNewOrg}>
              Continue
            </Button>
          </DialogFooter>
        </>
      ) : (
        <FinishOrgCreation
          onCompleted={handleOnCompleted}
          onError={onCreateOrgError}
        />
      )}
    </>
  );
}

export default memo(UpgradeProjectDialogContent);
