import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { AppDialog } from '@/components/layout/AppDialog';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';
import TransferProjectDialogContent from './TransferProjectDialogContent';

interface TransferProjectDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export default function TransferProjectDialog({
  open,
  setOpen,
}: TransferProjectDialogProps) {
  const { asPath, query, isReady: isRouterReady } = useRouter();
  const { session_id } = query;
  const { loading: projectLoading } = useProject();
  const { state } = useAppState();
  const { loading: orgsLoading } = useOrgs();
  const isProjectNotPaused = state !== ApplicationStatus.Paused;

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
  const redirectUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${path}` : '';

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

  if (projectLoading || orgsLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <AppDialog
        type="form"
        open={open}
        onOpenChange={handleTransferProjectDialogOpenChange}
        title="Move the current project to a different organization."
        contentClassName="z-[9999]"
      >
        <TransferProjectDialogContent
          onFinishOrgCreationCompleted={handleFinishOrgCreationCompleted}
          onFinishOrgError={() => setPreventClose(false)}
          onCreateNewOrg={handleCreateNewOrg}
          onCancel={handleCancel}
          selectedOrganizationId={selectedOrgId}
          onOrganizationChange={setSelectedOrgId}
        />
      </AppDialog>
      <CreateOrgDialog
        hideNewOrgButton
        isOpen={showCreateOrgModal}
        onOpenStateChange={handleCreateDialogOpenStateChange}
        redirectUrl={redirectUrl}
        isStarterDisabled={isProjectNotPaused}
      />
    </>
  );
}
