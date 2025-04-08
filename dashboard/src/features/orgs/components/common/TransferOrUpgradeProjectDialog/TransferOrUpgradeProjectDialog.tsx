import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Dialog, DialogContent } from '@/components/ui/v3/dialog';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import TransferProjectDialogContent from './TransferProjectDialogContent';
import UpgradeProjectDialogContent from './UpgradeProjectDialogContent';

interface TransferProjectDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  isUpgrade?: boolean;
}

export default function TransferOrUpgradeProjectDialog({
  open,
  setOpen,
  isUpgrade,
}: TransferProjectDialogProps) {
  const { asPath, query, isReady: isRouterReady } = useRouter();
  const { session_id } = query;
  const { loading: projectLoading } = useProject();
  const { loading: orgsLoading } = useOrgs();

  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [preventClose, setPreventClose] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>();

  useEffect(() => {
    if (session_id && isRouterReady) {
      setOpen(true);
      setPreventClose(true);
    }
  }, [session_id, setOpen, isRouterReady]);

  const path = asPath.split('?')[0];
  const redirectUrl = `${window.location.origin}${path}`;

  const handleCreateDialogOpenStateChange = (newState: boolean) => {
    setShowCreateOrgModal(newState);
    setOpen(true);
  };

  const handleFinishOrgCreationCompleted = useCallback(async () => {
    setPreventClose(false);
  }, []);

  const handleTransferProjectDialogOpenChange = (newValue: boolean) => {
    if (preventClose) {
      return;
    }
    if (!newValue) {
      setSelectedOrgId(undefined);
    }

    setOpen(newValue);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleCreateNewOrg = () => {
    setShowCreateOrgModal(true);
    setOpen(false);
  };
  const handleOnCreateOrgError = useCallback(() => setPreventClose(false), []);

  if (projectLoading || orgsLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleTransferProjectDialogOpenChange}>
        <DialogContent className="z-[9999] text-foreground sm:max-w-xl">
          {isUpgrade ? (
            <UpgradeProjectDialogContent
              onCancel={handleCancel}
              onCreateNewOrg={handleCreateNewOrg}
              onCreateOrgError={handleOnCreateOrgError}
            />
          ) : (
            <TransferProjectDialogContent
              onFinishOrgCreationCompleted={handleFinishOrgCreationCompleted}
              onFinishOrgError={() => setPreventClose(false)}
              onCreateNewOrg={handleCreateNewOrg}
              onCancel={handleCancel}
              selectedOrganizationId={selectedOrgId}
              onOrganizationChange={setSelectedOrgId}
            />
          )}
        </DialogContent>
      </Dialog>
      <CreateOrgDialog
        hideNewOrgButton
        isOpen={showCreateOrgModal}
        onOpenStateChange={handleCreateDialogOpenStateChange}
        redirectUrl={redirectUrl}
      />
    </>
  );
}
