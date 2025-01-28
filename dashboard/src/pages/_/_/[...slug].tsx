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
import { Fragment, useEffect, useMemo, useState } from 'react';

type Workspace = Omit<
  GetAllWorkspacesAndProjectsQuery['workspaces'][0],
  '__typename'
>;

export default function SelectWorkspaceAndProject() {
  const user = useUserData();
  const router = useRouter();

  const { data, loading } = useGetAllWorkspacesAndProjectsQuery({
    skip: !user,
  });

  const workspaces: Workspace[] = data?.workspaces || [];

  const projects = workspaces.flatMap((workspace) =>
    workspace.projects.map((project) => ({
      workspaceName: workspace.name,
      projectName: project.name,
      value: `${workspace.slug}/${project.slug}`,
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

  const goToProjectPage = async (project: {
    workspaceName: string;
    projectName: string;
    value: string;
  }) => {
    const { slug } = router.query;

    await router.push({
      pathname: `/${project.value}/${
        Array.isArray(slug) ? slug.join('/') : slug
      }`,
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
          Select a Project
        </Text>

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
                      className="grid grid-flow-col justify-start gap-2 py-2.5"
                      secondaryAction={
                        <Button
                          variant="borderless"
                          color="primary"
                          onClick={() => goToProjectPage(project)}
                        >
                          Select
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
    <AuthenticatedLayout title="Select a Project">{page}</AuthenticatedLayout>
  );
};
