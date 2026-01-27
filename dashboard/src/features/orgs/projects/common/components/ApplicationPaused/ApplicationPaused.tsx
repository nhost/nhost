import { DialogDescription } from '@radix-ui/react-dialog';
import { useState } from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/v2/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/v3/dialog';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { ApplicationPausedBanner } from '@/features/orgs/projects/common/components/ApplicationPausedBanner';
import { RemoveApplicationModal } from '@/features/orgs/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function ApplicationPaused() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const isOwner = useIsCurrentUserOwner();
  const [transferProjectDialogOpen, setTransferProjectDialogOpen] =
    useState(false);

  const [showDeletingModal, setShowDeletingModal] = useState(false);

  return (
    <>
      <Dialog open={showDeletingModal} onOpenChange={setShowDeletingModal}>
        <DialogContent
          className="!bg-red !shadow-none !p-0 max-w-sm border-none"
          hideCloseButton
        >
          <DialogTitle className="sr-only">
            {`Remove project ${project?.name}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {`The project ${project?.name} will be removed. All data will be lost
            and there will be no way to recover the app once it has been
            deleted.`}
          </DialogDescription>
          <RemoveApplicationModal
            close={() => setShowDeletingModal(false)}
            title={`Remove project ${project?.name}?`}
            description={`The project ${project?.name} will be removed. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
            className="z-50"
          />
        </DialogContent>
      </Dialog>

      <Container className="mx-auto grid max-w-lg grid-flow-row gap-6 text-center">
        <div className="mx-auto flex w-full max-w-xs flex-col gap-4">
          <ApplicationPausedBanner
            alertClassName="items-center"
            textContainerClassName="items-center text-center"
          />
          {org && (
            <>
              <Button
                className="w-full"
                onClick={() => setTransferProjectDialogOpen(true)}
              >
                Transfer
              </Button>

              <TransferProjectDialog
                open={transferProjectDialogOpen}
                setOpen={setTransferProjectDialogOpen}
              />
            </>
          )}

          {isOwner && (
            <Button
              color="error"
              variant="outlined"
              className="mx-auto w-full max-w-xs"
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
