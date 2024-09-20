import { useDialog } from '@/components/common/DialogProvider';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import {
  useGetAllWorkspacesAndProjectsQuery,
  type GetAllWorkspacesAndProjectsQuery,
} from '@/utils/__generated__/graphql';
import { Divider } from '@mui/material';
import { useUserData } from '@nhost/nextjs';
import debounce from 'lodash.debounce';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ChangeEvent, ReactElement } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

type Workspace = Omit<
  GetAllWorkspacesAndProjectsQuery['workspaces'][0],
  '__typename'
>;

export default function SelectWorkspaceAndProject() {
  const user = useUserData();
  const router = useRouter();
  const { openAlertDialog } = useDialog();

  const { data, loading } = useGetAllWorkspacesAndProjectsQuery({
    skip: !user,
  });

  const workspaces: Workspace[] = data?.workspaces || [];

  const projects = workspaces.flatMap((workspace) =>
    workspace.projects.map((project) => ({
      workspaceName: workspace.name,
      projectName: project.name,
      value: `${workspace.slug}/${project.slug}`,
      isFree: project.legacyPlan.isFree,
    })),
  );

  const [filter, setFilter] = useState('');

  const handleFilterChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        setFilter(event.target.value);
      }, 200),
    [],
  );

  useEffect(() => () => handleFilterChange.cancel(), [handleFilterChange]);

  const checkConfigFromQuery = useCallback(
    (base64Config: string) => {
      try {
        JSON.parse(atob(base64Config));
      } catch (error) {
        openAlertDialog({
          title: 'Configuration not set properly',
          payload:
            'Either the link is wrong or the configuration is not properly encoded',
          props: {
            primaryButtonText: 'Ok',
            hideSecondaryAction: true,
            onPrimaryAction: async () => {
              await router.push('/');
            },
          },
        });
      }
    },
    [openAlertDialog, router],
  );

  useEffect(() => {
    const config = router.query?.config as string;

    if (config) {
      checkConfigFromQuery(router.query?.config as string);
    }
  }, [checkConfigFromQuery, router.query]);

  const goToServices = async (project: {
    workspaceName: string;
    projectName: string;
    value: string;
    isFree: boolean;
  }) => {
    if (!project) {
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

    if (project.isFree) {
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

    await router.push({
      pathname: `/${project.value}/services`,
      // Keep the same query params that got us here
      query: router.query,
    });
  };

  const projectsToDisplay = filter
    ? projects.filter((project) =>
        project.projectName.toLowerCase().includes(filter.toLowerCase()),
      )
    : projects;

  if (loading) {
    return (
      <div className="flex w-full justify-center">
        <ActivityIndicator
          delay={500}
          label="Loading workspaces and projects..."
        />
      </div>
    );
  }

  return (
    <Container>
      <div className="mx-auto grid max-w-[760px] grid-flow-row gap-4 py-6 sm:py-14">
        <Text variant="h2" component="h1" className="">
          New Run Service
        </Text>

        <InfoCard
          title="Please select the workspace and the project where you want to create the service"
          disableCopy
          value=""
        />

        <div>
          <div className="mb-2 flex w-full">
            <Input
              placeholder="Search..."
              onChange={handleFilterChange}
              fullWidth
              autoFocus
            />
          </div>
          <RetryableErrorBoundary>
            {projectsToDisplay.length === 0 ? (
              <Box className="h-import py-2">
                <Text variant="subtitle2">No results found.</Text>
              </Box>
            ) : (
              <List className="h-import overflow-y-auto">
                {projectsToDisplay.map((project, index) => (
                  <Fragment key={project.value}>
                    <ListItem.Root
                      className="grid grid-flow-col justify-start gap-2  py-2.5"
                      secondaryAction={
                        <Button
                          variant="borderless"
                          color="primary"
                          onClick={() => goToServices(project)}
                        >
                          Proceed
                        </Button>
                      }
                    >
                      <ListItem.Avatar>
                        <span className="inline-block h-6 w-6 overflow-hidden rounded-md">
                          <Image
                            src="/logos/new.svg"
                            alt="Nhost Logo"
                            width={24}
                            height={24}
                          />
                        </span>
                      </ListItem.Avatar>
                      <ListItem.Text
                        primary={project.projectName}
                        secondary={`${project.workspaceName} / ${project.projectName}`}
                      />
                    </ListItem.Root>

                    {index < projects.length - 1 && <Divider component="li" />}
                  </Fragment>
                ))}
              </List>
            )}
          </RetryableErrorBoundary>
        </div>
      </div>
    </Container>
  );
}

SelectWorkspaceAndProject.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="New Run Service">{page}</AuthenticatedLayout>
  );
};
