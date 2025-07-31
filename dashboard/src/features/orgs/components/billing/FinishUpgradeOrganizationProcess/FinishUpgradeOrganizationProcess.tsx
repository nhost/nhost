import { Dialog, DialogContent, DialogTitle } from '@/components/ui/v3/dialog';
import { FinishOrganizationProcess } from '@/features/orgs/components/common/FinishOrganizationProcess';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { analytics } from '@/lib/segment';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

function FinishUpgradeOrganizationProcess() {
  const { refetch: refetchOrg, org } = useCurrentOrg();
  const { refetch: refetchOrgs } = useOrgs();
  const [open, setOpen] = useState(false);
  const [hideCloseButton, setHideCloseButton] = useState(false);
  const { query, isReady: isRouterReady, replace, pathname } = useRouter();
  const { session_id, ...remainingQuery } = query;

  const removeSessionIdFromQuery = useCallback(() => {
    replace({ pathname, query: remainingQuery }, undefined, {
      shallow: true,
    });
  }, [replace, remainingQuery, pathname]);

  useEffect(() => {
    if (session_id && isRouterReady) {
      setOpen(true);
    }
  }, [session_id, setOpen, isRouterReady]);

  async function handleOnCompleted() {
    removeSessionIdFromQuery();
    const result = await refetchOrg();
    const updatedOrg = result?.data?.organizations?.[0];
    await refetchOrgs();
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
