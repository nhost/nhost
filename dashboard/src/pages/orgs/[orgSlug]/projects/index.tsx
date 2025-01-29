import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import { ProjectsGrid } from '@/features/orgs/components/projects/projects-grid';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useGetOrganizationProjectsQuery } from '@/utils/__generated__/graphql';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export default function OrgProjects() {
  const { currentOrg } = useOrgs();

  const { data, loading } = useGetOrganizationProjectsQuery({
    variables: {
      orgId: currentOrg?.id,
    },
    skip: !currentOrg,
  });

  const apps = data?.apps;

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ActivityIndicator circularProgressProps={{ className: 'w-6 h-6' }} />
      </div>
    );
  }

  if (apps?.length === 0) {
    return (
      <div className="flex h-full w-full items-start justify-center bg-accent p-4">
        <div className="flex w-full flex-col items-center justify-center space-y-8 rounded-md border bg-background p-12">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-xl font-medium">Welcome to Nhost!</h2>
            <p className="text-muted-foreground">
              Let&apos;s set up your first backend - the Nhost way.
            </p>
          </div>

          <Button asChild>
            <Link href={`/orgs/${currentOrg.slug}/projects/new`}>
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
    <div className="h-full bg-accent">
      <ProjectsGrid />
    </div>
  );
}

OrgProjects.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
