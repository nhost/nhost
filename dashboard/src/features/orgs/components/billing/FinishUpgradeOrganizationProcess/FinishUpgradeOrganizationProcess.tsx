import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/v3/dialog';
import { FinishOrganizationProcess } from '@/features/orgs/components/common/FinishOrganizationProcess';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';
import { analytics } from '@/lib/segment';

function FinishUpgradeOrganizationProcess() {
  const { refetch: refetchOrg, org } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [hideCloseButton, setHideCloseButton] = useState(true);
  const { query, isReady: isRouterReady } = useRouter();
  const { session_id } = query;

  const removeQueryParamsFromUrl = useRemoveQueryParamsFromUrl();

  useEffect(() => {
    if (session_id && isRouterReady) {
      setOpen(true);
    }
  }, [session_id, isRouterReady]);

  async function handleOnCompleted() {
    removeQueryParamsFromUrl('session_id');
    const result = await refetchOrg();
    const updatedOrg = result?.data?.organizations?.[0];
    setOpen(false);
    analytics.track('Organization upgraded from starter', {
      organizationId: updatedOrg.id,
      organizationName: updatedOrg.name,
      organizationSlug: updatedOrg.slug,
      newOrganizationPlan: updatedOrg.plan.name,
      organizationPlanId: updatedOrg.plan.id,
    });
  }

  function handleOnError() {
    setHideCloseButton(false);
  }
  return (
    <Dialog open={open}>
      <DialogContent
        className="z-[9999] text-foreground sm:max-w-xl"
        hideCloseButton={hideCloseButton}
      >
        <DialogTitle>Upgrade Organization {org?.name}</DialogTitle>
        <FinishOrganizationProcess
          onCompleted={handleOnCompleted}
          onError={handleOnError}
          loadingMessage="Upgrading organization"
          successMessage="Organization has been upgraded successfully."
          pendingMessage="Upgrading Organization is pending..."
          errorMessage="Error occurred while upgrading the organization. Please try again."
          withDialogDescription
        />
      </DialogContent>
    </Dialog>
  );
}

export default FinishUpgradeOrganizationProcess;
