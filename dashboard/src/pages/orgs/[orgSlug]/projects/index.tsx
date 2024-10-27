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
      <div className="flex items-center justify-center w-full h-full">
        <ActivityIndicator circularProgressProps={{ className: 'w-6 h-6' }} />
      </div>
    );
  }

  if (apps?.length === 0) {
    return (
      <div className="flex items-start justify-center w-full h-full p-4 bg-accent">
        <div className="flex flex-col items-center justify-center w-full p-12 space-y-8 border rounded-md bg-background">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-xl font-medium">Welcome to Nhost!</h2>
            <p className="text-muted-foreground">
              Let&apos;s set up your first backend - the Nhost way.
            </p>
          </div>

          <Button asChild>
            <Link href={`/orgs/${currentOrg.slug}/projects/new`}>
              <div className="flex flex-row items-center justify-center space-x-2 h-fit">
                <Plus className="w-5 h-5" strokeWidth={2} />
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
