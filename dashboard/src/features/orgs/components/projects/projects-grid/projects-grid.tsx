import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Input } from '@/components/ui/v2/Input';
import { Button } from '@/components/ui/v3/button';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { DeploymentStatusMessage } from '@/features/projects/deployments/components/DeploymentStatusMessage';
import {
  useGetProjectsQuery,
  type GetProjectsQuery,
} from '@/utils/__generated__/graphql';
import debounce from 'lodash.debounce';
import { ArrowRight, Box, Plus, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type ChangeEvent } from 'react';

type Project = GetProjectsQuery['apps'][0];

function ProjectCard({ project }: { project: Project }) {
  const { org } = useCurrentOrg();

  const [latestDeployment] = project.deployments;

  return (
    <Link
      href={`/orgs/${org?.slug}/projects/${project.subdomain}`}
      className="flex cursor-pointer flex-col gap-4 rounded-lg border bg-background p-4 hover:shadow-sm"
    >
      <div className="flex items-start gap-2">
        <div className="flex w-full flex-row items-center space-x-2">
          <Box className="h-6 w-6 flex-shrink-0" />
          <p className="truncate text-lg font-bold">{project.name}</p>
        </div>
      </div>

      <div className="flex flex-row items-start gap-2">
        <DeploymentStatusMessage
          appCreatedAt={project.createdAt}
          deployment={latestDeployment}
        />
      </div>

      <div className="flex w-full justify-end">
        <ArrowRight />
      </div>
    </Link>
  );
}

export default function ProjectsGrid() {
  const { org } = useCurrentOrg();

  const { data, loading, error } = useGetProjectsQuery({
    variables: {
      orgSlug: org?.slug,
    },
    skip: !org,
  });

  const [query, setQuery] = useState('');

  const handleQueryChange = debounce((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, 500);

  const projects = data?.apps ?? [];

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (error) {
    throw error;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto h-full overflow-auto bg-accent">
      <div className="flex w-full flex-shrink-0 flex-row items-center justify-between gap-2 border-b bg-background p-2">
        <Input
          placeholder="Find Project"
          fullWidth
          className="max-w-lg"
          startAdornment={
            <div className="flex w-8 items-center justify-center">
              <SearchIcon className="h-5 w-4 text-muted-foreground" />
            </div>
          }
          onChange={handleQueryChange}
        />

        <Button asChild>
          <Link href={`/orgs/${org?.slug}/projects/new`}>
            <div className="flex h-fit flex-row items-center justify-center space-x-2">
              <Plus className="h-5 w-5" strokeWidth={2} />
              <span>Create project</span>
            </div>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
