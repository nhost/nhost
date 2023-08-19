import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v2/Button';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import {
  useGetAllWorkspacesAndProjectsQuery,
  type GetAllWorkspacesAndProjectsQuery,
} from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

type Workspace = Omit<
  GetAllWorkspacesAndProjectsQuery['workspaces'][0],
  '__typename'
>;

export default function SelectWorkspaceAndProject() {
  const user = useUserData();
  const router = useRouter();
  const { openAlertDialog } = useDialog();

  const { maintenanceActive } = useUI();

  const { data, loading } = useGetAllWorkspacesAndProjectsQuery({
    skip: !user,
  });

  const workspaces: Workspace[] = data?.workspaces || [];

  const preSelectedWorkspace = workspaces.length > 0 ? workspaces[0] : null;

  const [selectedWorkspace, setSelectedWorkspace] =
    useState(preSelectedWorkspace);

  const [selectedProject, setSelectedProject] =
    useState<typeof preSelectedWorkspace.projects[0]>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedWorkspace || !selectedProject) {
      openAlertDialog({
        title: 'Please select a workspace and a project',
        payload:
          'You must select a workspace and a project before proceeding to create the run service',
        props: {
          primaryButtonText: 'Ok',
          hideSecondaryAction: true,
        },
      });

      return;
    }

    if (selectedProject.plan.isFree) {
      openAlertDialog({
        title: 'The project must have a pro plan',
        payload: 'Creating run services is only availabel for pro projects',
        props: {
          primaryButtonText: 'Ok',
          hideSecondaryAction: true,
        },
      });

      return;
    }

    router.push({
      pathname: `/${selectedWorkspace.slug}/${selectedProject.slug}/services`,

      // Keep the same query params that got us here
      query: router.query,
    });
  }

  if (loading) {
    return (
      <ActivityIndicator
        delay={500}
        label="Loading workspaces and projects..."
      />
    );
  }

  return (
    <Container>
      <form onSubmit={handleSubmit}>
        <div className="mx-auto grid max-w-[760px] grid-flow-row gap-4 py-6 sm:py-14">
          <Text variant="h2" component="h1" className="">
            New Run Service
          </Text>

          <InfoCard
            title="Please select the workspace and the project where you want to create the service"
            disableCopy
            value=""
          />
          <div className="grid grid-flow-row gap-4">
            <Select
              id="workspace"
              label="Workspace"
              variant="inline"
              hideEmptyHelperText
              placeholder="Select Workspace"
              slotProps={{
                root: { className: 'grid grid-flow-col gap-1' },
              }}
              onChange={(_event, value) =>
                setSelectedWorkspace(workspaces.find(({ id }) => id === value))
              }
              value={selectedWorkspace?.id ?? ''}
              renderValue={(option) => (
                <span className="inline-grid grid-flow-col items-center gap-2">
                  {option?.label}
                </span>
              )}
            >
              {workspaces.map((option) => (
                <Option
                  value={option.id}
                  key={option.id}
                  className="grid grid-flow-col items-center gap-2"
                >
                  <span className="inline-block h-6 w-6 overflow-hidden rounded-md">
                    <Image
                      src="/logos/new.svg"
                      alt="Nhost Logo"
                      width={24}
                      height={24}
                    />
                  </span>

                  {option.name}
                </Option>
              ))}
            </Select>

            <Select
              id="project"
              label="Project"
              variant="inline"
              hideEmptyHelperText
              placeholder="Select Project"
              disabled={selectedWorkspace?.projects.length === 0}
              slotProps={{
                root: { className: 'grid grid-flow-col gap-1' },
              }}
              onChange={(_event, value) =>
                setSelectedProject(
                  selectedWorkspace.projects.find(({ id }) => id === value),
                )
              }
              value={selectedProject?.id ?? ''}
              renderValue={(option) => (
                <span className="inline-grid grid-flow-col items-center gap-2">
                  {option?.label}
                </span>
              )}
            >
              {selectedWorkspace?.projects.map((project) => (
                <Option
                  value={project.id}
                  key={project.id}
                  className="grid grid-flow-col items-center gap-2"
                >
                  <span className="inline-block h-6 w-6 overflow-hidden rounded-md">
                    <Image
                      src="/logos/new.svg"
                      alt="Nhost Logo"
                      width={24}
                      height={24}
                    />
                  </span>

                  {project.name}
                </Option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={maintenanceActive} id="create-app">
              Proceed
            </Button>
          </div>
        </div>
      </form>
    </Container>
  );
}

SelectWorkspaceAndProject.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="New Run Service">{page}</AuthenticatedLayout>
  );
};
