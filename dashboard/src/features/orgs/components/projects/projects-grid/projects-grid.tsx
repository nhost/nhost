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
    <div className="flex flex-col gap-4 p-4 border rounded-lg cursor-pointer bg-background hover:shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex flex-row items-center space-x-2">
          <Box className="w-6 h-6" />
          <h2 className="text-lg font-semibold">{project.name}</h2>
        </div>
      </div>

      <div className="flex flex-row items-start gap-2">
        <DeploymentStatusMessage
          appCreatedAt={project.createdAt}
          deployment={latestDeployment}
        />
      </div>

      <div className="flex justify-end w-full">
        <Button asChild variant="secondary">
          <Link href={`/orgs/${org?.slug}/projects/${project.slug}`}>
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
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
    <div className="h-full mx-auto overflow-auto bg-muted/50">
      <div className="flex flex-row items-center justify-between flex-shrink-0 w-full p-2 border-b bg-background">
        <Input
          placeholder="Find Project"
          fullWidth
          className="max-w-lg"
          startAdornment={
            <div className="flex items-center justify-center w-8">
              <SearchIcon className="w-4 h-5 text-muted-foreground" />
            </div>
          }
          onChange={handleQueryChange}
        />

        <Button asChild>
          <Link href={`/orgs/${org?.slug}/projects/new`}>
            <div className="flex flex-row items-center justify-center space-x-2 h-fit">
              <Plus className="w-5 h-5" strokeWidth={2} />
              <span>Create project</span>
            </div>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
