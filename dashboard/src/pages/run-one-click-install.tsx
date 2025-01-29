import { useDialog } from '@/components/common/DialogProvider';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { Badge } from '@/components/ui/v3/badge';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useWorkspaces } from '@/features/orgs/projects/hooks/useWorkspaces';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import { cn } from '@/lib/utils';
import { Divider } from '@mui/material';
import debounce from 'lodash.debounce';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ChangeEvent, ReactElement } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

interface ProjectSelectorOption {
  type: 'workspace-project' | 'org-project';
  projectName: string;
  projectPathDescriptor: string;
  route: string;
  isFree: boolean;
  plan: string;
}

export default function SelectWorkspaceAndProject() {
  const router = useRouter();
  const { openAlertDialog } = useDialog();
  const { orgs, loading: loadingOrgs } = useOrgs();
  const { workspaces, loading: loadingWorkspaces } = useWorkspaces();

  const workspaceProjects: ProjectSelectorOption[] = workspaces.flatMap(
    (workspace) =>
      workspace.projects.map((project) => ({
        type: 'workspace-project',
        projectName: project.name,
        projectPathDescriptor: `${workspace.name}/${project.name}`,
        route: `${workspace.slug}/${project.slug}/services`,
        isFree: project.legacyPlan.isFree,
        plan: project.legacyPlan.name,
      })),
  );

  const orgProjects: ProjectSelectorOption[] = orgs.flatMap((org) =>
    org.apps.map((project) => ({
      type: 'org-project',
      projectName: project.name,
      projectPathDescriptor: `${org.name}/${project.name}`,
      route: `/orgs/${org.slug}/projects/${project.subdomain}/run`,
      isFree: org.plan.isFree,
      plan: org.plan.name,
    })),
  );

  const projects = [...orgProjects, ...workspaceProjects];

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

  const goToServices = async (project: ProjectSelectorOption) => {
    if (!project) {
      openAlertDialog({
        title: 'Please select a project',
        payload:
          'You must select a project before proceeding to create the run service',
        props: {
          primaryButtonText: 'Ok',
          hideSecondaryAction: true,
        },
      });

      return;
    }

    if (project.isFree) {
      openAlertDialog({
        title: 'Cannot proceed',
        payload: 'Creating run services is only available on a Pro plan',
        props: {
          primaryButtonText: 'Ok',
          hideSecondaryAction: true,
        },
      });

      return;
    }

    await router.push({ pathname: project.route, query: router.query });
  };

  const projectsToDisplay = filter
    ? projects.filter((project) =>
        project.projectName.toLowerCase().includes(filter.toLowerCase()),
      )
    : projects;

  if (loadingWorkspaces || loadingOrgs) {
    return (
      <div className="flex w-full justify-center">
        <ActivityIndicator delay={500} label="Loading projects..." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full flex-col items-start bg-background px-5 py-4">
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col gap-4 py-6 sm:py-14">
        <h1 className="text-2xl font-medium">New Run Service</h1>

        <InfoCard
          title="Please select the project where you want to create the service"
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
              <List className="flex h-import flex-col gap-2 overflow-y-auto">
                {projectsToDisplay.map((project, index) => (
                  <Fragment key={project.projectPathDescriptor}>
                    <ListItem.Root
                      className="flex flex-row items-center justify-center gap-4"
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
                      <ListItem.Avatar className="flex h-full items-center justify-center">
                        <Image
                          src="/logos/new.svg"
                          alt="Nhost Logo"
                          className="h-10 w-10 rounded-md"
                          width={38}
                          height={38}
                        />
                      </ListItem.Avatar>
                      <ListItem.Text
                        primary={
                          <div className="flex items-center">
                            <span>{project.projectName}</span>
                            <Badge
                              variant={project.isFree ? 'outline' : 'default'}
                              className={cn(
                                'hover:none ml-2 h-5 px-[6px] text-[10px]',
                                project.isFree && 'bg-muted',
                                project.type === 'workspace-project' &&
                                  'bg-orange-200 text-foreground hover:bg-orange-200 dark:bg-orange-500',
                              )}
                            >
                              {project.type === 'workspace-project'
                                ? 'Legacy'
                                : project.plan}
                            </Badge>
                          </div>
                        }
                        secondary={project.projectPathDescriptor}
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
    </div>
  );
}

SelectWorkspaceAndProject.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="New Run Service">{page}</AuthenticatedLayout>
  );
};
