import debounce from 'lodash.debounce';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';

export default function SelectOrganizationAndProject() {
  const { orgs, loading } = useOrgs();
  const router = useRouter();

  const projects = orgs.flatMap((org) =>
    org.apps.map((app) => ({
      organizationName: org.name,
      projectName: app.name,
      value: `/orgs/${org.slug}/projects/${app.subdomain}`,
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
    organizationName: string;
    projectName: string;
    value: string;
  }) => {
    const { slug } = router.query;
    await router.push({
      pathname: `${project.value}/${(() => {
        if (!slug) {
          return '';
        }
        return Array.isArray(slug) ? slug.join('/') : slug;
      })()}`,
    });
  };

  const projectsToDisplay = filter
    ? projects.filter((project) =>
        project.projectName.toLowerCase().includes(filter.toLowerCase()),
      )
    : projects;

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-5 py-4">
        <Spinner size="medium" />
        <span className="text-muted-foreground text-sm">
          Loading organizations and projects...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full flex-col items-start bg-background px-5 py-4">
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col gap-4 py-6 sm:py-14">
        <h1 className="font-medium text-2xl">Select a Project</h1>

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
                    key={project.value}
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
                      <span className="block truncate">
                        {project.projectName}
                      </span>
                      <p className="truncate text-muted-foreground text-sm">
                        {`${project.organizationName} / ${project.projectName}`}
                      </p>
                    </div>
                    <Button
                      variant="link"
                      onClick={() => goToProjectPage(project)}
                    >
                      Select
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
