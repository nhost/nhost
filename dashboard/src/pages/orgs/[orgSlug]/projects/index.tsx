import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import { ProjectsGrid } from '@/features/orgs/components/projects/projects-grid';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useGetProjectsQuery } from '@/utils/__generated__/graphql';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export default function OrgProjects() {
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
        <ActivityIndicator circularProgressProps={{ className: 'w-6 h-6' }} />
      </div>
    );
  }

  if (apps?.length === 0) {
    return (
      <div className="flex h-full w-full items-start justify-center bg-accent-background p-4">
        <div className="flex w-full flex-col items-center justify-center space-y-8 rounded-md border bg-background p-12">
          <div className="flex flex-col items-center justify-center">
            <h2 className="font-medium text-xl">Welcome to Nhost!</h2>
            <p className="text-muted-foreground">
              Let&apos;s set up your first backend - the Nhost way.
            </p>
          </div>

          <Button asChild>
            <Link href={`/orgs/${currentOrg?.slug}/projects/new`}>
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
    <div className="h-full bg-accent-background">
      <ProjectsGrid projects={apps} />
    </div>
  );
}

OrgProjects.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout isOrgPage>{page}</OrgLayout>;
};
