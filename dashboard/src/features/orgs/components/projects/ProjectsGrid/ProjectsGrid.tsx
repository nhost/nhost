import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/v3/button';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { DeploymentFailedWarning } from '@/features/orgs/components/projects/DeploymentFailedWarning';
import { ProjectLastDeployment } from '@/features/orgs/components/projects/ProjectLastDeployment';
import { ProjectRegionFlag } from '@/features/orgs/components/projects/ProjectRegionFlag';
import { ProjectRepository } from '@/features/orgs/components/projects/ProjectRepository';
import { getLatestDeployment } from '@/features/orgs/components/projects/utils/getLatestDeployment';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { GetProjectsQuery } from '@/generated/graphql';

export type Project = GetProjectsQuery['apps'][0];

export function ProjectCard({ project }: { project: Project }) {
  const { org } = useCurrentOrg();

  const latestDeployment = getLatestDeployment(project);
  const status = project.appStates[0]?.stateId;
  // Two projects can share a name, so the region tells their links apart.
  const linkLabel = project.region.name
    ? `Open ${project.name} (${project.region.name})`
    : `Open ${project.name}`;

  // The link is a layer under the whole card, not a wrapper: the warning icon
  // sits above it, so its tooltip opens without opening the project.
  return (
    <div className="group relative flex h-full min-h-44 flex-col rounded-lg transition-colors duration-300">
      <Link
        href={`/orgs/${org?.slug}/projects/${project.subdomain}`}
        aria-label={linkLabel}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="relative flex flex-1 cursor-pointer flex-col gap-4 overflow-hidden rounded-lg border bg-background p-4 transition-[border-color,box-shadow] duration-300 group-hover:border-primary group-hover:shadow-[0_0_12px_hsl(var(--primary)/20%)]">
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <div className="flex items-center gap-2">
            <p
              title={project.name}
              className="min-w-0 truncate font-bold text-lg"
            >
              {project.name}
            </p>
            <ProjectRegionFlag region={project.region} />
            {project.githubRepository && (
              <DeploymentFailedWarning latest={latestDeployment} />
            )}
          </div>
          <ProjectRepository project={project} />
        </div>

        {/* Without a repo the dashboard hides deployments everywhere else,
            so the card shows none either and the spot stays empty. */}
        <div className="flex flex-1 flex-row items-start gap-2">
          {project.githubRepository && (
            <ProjectLastDeployment latest={latestDeployment} />
          )}
        </div>

        <div className="flex w-full flex-row items-center justify-between gap-2">
          <ProjectStatusPill status={status} />
          <ArrowRight className="ml-auto flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
}

interface ProjectGridProps {
  projects: Project[];
}

export default function ProjectsGrid({ projects }: ProjectGridProps) {
  const { org } = useCurrentOrg();

  return (
    <div className="mx-auto h-full overflow-auto bg-background pb-16">
      <div className="mx-auto flex w-full max-w-5xl flex-shrink-0 flex-row items-center justify-between gap-2 px-5 pt-8 pb-4">
        <h1 className="font-semibold text-3xl">Projects</h1>
        <Button asChild>
          <Link href={`/orgs/${org?.slug}/projects/new`}>
            <Plus className="mr-2 h-5 w-5" strokeWidth={2} />
            Create project
          </Link>
        </Button>
      </div>
      {/* auto-rows-fr: every row as tall as the tallest card, deployment or not. */}
      <div className="mx-auto grid w-full max-w-5xl auto-rows-fr grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
