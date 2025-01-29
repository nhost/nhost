import { ContactUs } from '@/components/common/ContactUs';
import { Container } from '@/components/layout/Container';
import { Modal } from '@/components/ui/v1/Modal';
import { Button } from '@/components/ui/v2/Button';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { Text } from '@/components/ui/v2/Text';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationInfo } from '@/features/projects/common/components/ApplicationInfo';
import { RemoveApplicationModal } from '@/features/projects/common/components/RemoveApplicationModal';
import { StagingMetadata } from '@/features/projects/common/components/StagingMetadata';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import Image from 'next/image';
import { useState } from 'react';

export default function ApplicationUnknown() {
  const { project } = useProject();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const isOwner = useIsCurrentUserOwner();

  return (
    <>
      <Modal
        showModal={showDeleteModal}
        close={() => setShowDeleteModal(false)}
      >
        <RemoveApplicationModal
          close={() => setShowDeleteModal(false)}
          title={`Remove project ${project.name}?`}
          description={`The project ${project.name} will be removed. All data will be lost and there will be no way to
          recover the app once it has been deleted.`}
        />
      </Modal>
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
            this keeps happening, contact support.
          </Text>
        </div>

        <div className="mx-auto grid grid-flow-row gap-2">
          <Dropdown.Root>
            <Dropdown.Trigger
              hideChevron
              asChild
              className="w-full max-w-[240px]"
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
