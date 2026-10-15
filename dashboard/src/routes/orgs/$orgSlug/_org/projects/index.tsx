import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectsGrid } from '@/features/orgs/components/projects/projects-grid';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useGetProjectsQuery } from '@/generated/graphql';

export const Route = createFileRoute('/orgs/$orgSlug/_org/projects/')({
  component: OrgProjects,
});

function OrgProjects() {
  const { org: currentOrg, loading: currentOrgLoading } = useCurrentOrg();

  const { data, loading, error } = useGetProjectsQuery({
    variables: {
      orgSlug: currentOrg?.slug,
    },
    skip: !currentOrg,
    pollInterval: 10 * 1000,
  });

  if (error) {
    throw error;
  }

  const apps = data?.apps || [];

  if (loading || currentOrgLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="medium" />
      </div>
    );
  }

  if (apps?.length === 0) {
    return (
      <div className="flex h-full w-full items-start justify-center bg-background p-4">
        <div className="flex w-full flex-col items-center justify-center space-y-8 rounded-md border bg-background p-12">
          <div className="flex flex-col items-center justify-center">
            <h2 className="font-medium text-xl">Welcome to Nhost!</h2>
            <p className="text-muted-foreground">
              Let&apos;s set up your first backend - the Nhost way.
            </p>
          </div>

          <Button asChild>
            <Link from="/orgs/$orgSlug" to="/orgs/$orgSlug/projects/new" params>
              <div className="flex h-fit flex-row items-center justify-center space-x-2">
                <Plus className="h-5 w-5" strokeWidth={2} />
                <span>Create your first project</span>
              </div>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      <ProjectsGrid projects={apps} />
    </div>
  );
}
