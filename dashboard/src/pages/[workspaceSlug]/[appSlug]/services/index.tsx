import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ReactElement } from 'react';

const numberOfServices = 0;

export default function ServicesPage() {
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();

  const openCreateServiceDialog = () => {
    openDialog({
      title: 'Create new service',
      component: <span>Create Service Form Component</span>,
    });
  };

  if (numberOfServices === 0) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5 overflow-x-hidden">
        <div className="flex flex-row place-content-end">
          <Button
            variant="contained"
            color="primary"
            onClick={openCreateServiceDialog}
            startIcon={<PlusIcon className="h-4 w-4" />}
          >
            Add service
          </Button>
        </div>

        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <ServicesIcon className="h-10 w-10" />
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              No custom services are available
            </Text>
            <Text variant="subtitle1" className="text-center">
              All your project’s custom services will be listed here.
            </Text>
          </div>
          <div className="flex flex-row place-content-between rounded-lg ">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateServiceDialog}
              startIcon={<PlusIcon className="h-4 w-4" />}
            >
              Add service
            </Button>
          </div>
        </Box>
      </Container>
    );
  }

  return (
    <Container className="mt-12 grid max-w-3xl grid-flow-row gap-4 text-center antialiased">
      <div className="mx-auto flex w-centImage flex-col text-center">
        <Image
          src="/assets/githubRepo.svg"
          width={72}
          height={72}
          alt="GitHub Logo"
        />
      </div>
      <div className="grid grid-flow-row gap-2">
        <Text variant="h3" component="h1">
          Deployments
        </Text>
        <Text>
          Once you connect this app to version control, all changes will be
          deployed automatically.
        </Text>
      </div>

      <NavLink
        href={`/${currentWorkspace?.slug}/${currentProject?.slug}/settings/git`}
        passHref
      >
        <Button
          variant="borderless"
          className="mx-auto font-medium"
          disabled={maintenanceActive}
        >
          Connect your Project to GitHub
        </Button>
      </NavLink>
    </Container>
  );
}

ServicesPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
