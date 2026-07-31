import debounce from 'lodash.debounce';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';

interface ProjectSelectorOption {
  projectName: string;
  projectPathDescriptor: string;
  route: string;
  isFree: boolean;
  plan: string;
}

export default function SelectOrganizationAndProject() {
  const router = useRouter();
  const { openAlertDialog } = useDialog();
  const { orgs, loading: loadingOrgs } = useOrgs();

  const orgProjects: ProjectSelectorOption[] = orgs.flatMap((org) =>
    org.apps.map((project) => ({
      projectName: project.name,
      projectPathDescriptor: `${org.name}/${project.name}`,
      route: `/orgs/${org.slug}/projects/${project.subdomain}/run`,
      isFree: org.plan.isFree,
      plan: org.plan.name,
    })),
  );

  const projects = [...orgProjects];

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
      } catch {
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
      checkConfigFromQuery(config);
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

  if (loadingOrgs) {
    return (
      <div className="flex w-full justify-center">
        <Spinner size="medium" wrapperClassName="gap-2">
          Loading projects...
        </Spinner>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full flex-col items-start bg-background px-5 py-4">
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col gap-4 py-6 sm:py-14">
        <h1 className="font-medium text-2xl">New Run Service</h1>

        <div className="rounded-lg bg-muted p-3 shadow-sm">
          <p className="font-medium text-sm+">
            Please select the project where you want to create the service
          </p>
        </div>

        <div>
          <div className="mb-2 flex w-full">
            <Input
              placeholder="Search..."
              onChange={handleFilterChange}
              wrapperClassName="w-full"
              autoFocus
            />
          </div>
          <RetryableErrorBoundary>
            {projectsToDisplay.length === 0 ? (
              <div className="h-import py-2">
                <p className="text-muted-foreground text-sm">
                  No results found.
                </p>
              </div>
            ) : (
              <ul className="flex h-import flex-col overflow-y-auto rounded-md border">
                {projectsToDisplay.map((project, index) => (
                  <li
                    key={project.projectPathDescriptor}
                    className={cn(
                      'flex flex-row items-center justify-center gap-4 p-3',
                      index < projectsToDisplay.length - 1 && 'border-b',
                    )}
                  >
                    <div className="flex h-full items-center justify-center">
                      <Image
                        src="/logos/new.svg"
                        alt="Nhost Logo"
                        className="h-10 w-10 rounded-md"
                        width={38}
                        height={38}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center">
                        <span className="truncate">{project.projectName}</span>
                        <Badge
                          variant={project.isFree ? 'outline' : 'default'}
                          className={cn(
                            'hover:none ml-2 h-5 px-[6px] text-[10px]',
                            project.isFree && 'bg-muted',
                          )}
                        >
                          {project.plan}
                        </Badge>
                      </div>
                      <p className="truncate text-muted-foreground text-sm">
                        {project.projectPathDescriptor}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => goToServices(project)}
                    >
                      Proceed
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </RetryableErrorBoundary>
        </div>
      </div>
    </div>
  );
}

SelectOrganizationAndProject.getLayout = function getLayout(
  page: ReactElement,
) {
  return (
    <AuthenticatedLayout title="New Run Service">{page}</AuthenticatedLayout>
  );
};
