import Image from 'next/image';
import { useState } from 'react';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Button } from '@/components/ui/v2/Button';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { RemoveApplicationModal } from '@/features/orgs/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function ApplicationUnknown() {
  const { project, loading } = useProject();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const isOwner = useIsCurrentUserOwner();

  if (!project || loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent
          className="!bg-transparent !shadow-none !p-0 max-w-sm border-none"
          hideCloseButton
        >
          <DialogTitle className="sr-only">
            `Remove project ${project?.name}?`
          </DialogTitle>
          <DialogDescription className="sr-only">
            `The project ${project?.name} will be removed. All data will be lost
            and there will be no way to recover the app once it has been
            deleted.`
          </DialogDescription>
          <RemoveApplicationModal
            close={() => setShowDeleteModal(false)}
            title={`Remove project ${project.name}?`}
            description={`The project ${project.name} will be removed. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
          />
        </DialogContent>
      </Dialog>
      <Container className="mx-auto mt-8 grid max-w-sm grid-flow-row gap-4 text-center">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <Image
            src="/assets/ProvisioningFailed.svg"
            alt="Danger sign"
            width={72}
            height={72}
          />
        </div>

        <div id="setting-up" className="grid grid-flow-row gap-1">
          <Text variant="h3" component="h1">
            Unknown project state
          </Text>

          <Text className="mt-1 font-normal">
            Something on our end went wrong and we could not finish setup. If
            this keeps happening,{' '}
            <Link
              className="font-semibold underline underline-offset-2"
              href="/support"
              target="_blank"
              rel="noopener noreferrer"
            >
              contact support
            </Link>
            .
          </Text>
        </div>

        <div className="mx-auto grid grid-flow-row gap-2">
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
