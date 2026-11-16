import { Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { DeploymentFailedWarning } from '@/features/orgs/components/projects/DeploymentFailedWarning';
import { ProjectLastDeployment } from '@/features/orgs/components/projects/ProjectLastDeployment';
import { ProjectRepository } from '@/features/orgs/components/projects/ProjectRepository';
import type { Project } from '@/features/orgs/components/projects/ProjectsGrid';
import { getLatestDeployment } from '@/features/orgs/components/projects/utils/getLatestDeployment';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

function ProjectRegion({ region }: { region: Project['region'] }) {
  // Keyed on the code, so a refetch with another region shows its flag again.
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const { name, city, countryCode } = region;
  const label = city || name;

  if (!label) {
    return null;
  }

  const showFlag = !!countryCode && countryCode !== failedCode;

  // A button above the row link (z-20), so hovering or focusing it shows the
  // region code and flag without opening the project.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Region: ${city && name ? `${city} (${name})` : label}`}
          className="relative z-20 max-w-full truncate rounded-sm bg-transparent p-0 text-left text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {showFlag && (
          <Image
            src={`/assets/flags/${countryCode}.svg`}
            alt=""
            width={16}
            height={12}
            onError={() => setFailedCode(countryCode)}
          />
        )}
        {name || city}
      </TooltipContent>
    </Tooltip>
  );
}

function ProjectRow({
  project,
  orgSlug,
}: {
  project: Project;
  orgSlug?: string;
}) {
  const latestDeployment = getLatestDeployment(project);
  const status = project.appStates[0]?.stateId;
  // Two projects can share a name, so the region tells their links apart.
  const linkLabel = project.region.name
    ? `Open ${project.name} (${project.region.name})`
    : `Open ${project.name}`;

  // The name link stretches over the whole row (its ::before layer), like the
  // card's overlay link: one real link, so cmd, ctrl and middle click open a
  // new tab from any cell. The region and warning sit above it (z-20), so
  // their tooltips open without opening the project.
  return (
    <TableRow className="relative cursor-pointer hover:bg-muted/50">
      <TableCell className="py-3">
        <div className="flex min-w-0 max-w-[320px] items-center gap-2">
          <Link
            href={`/orgs/${orgSlug}/projects/${project.subdomain}`}
            aria-label={linkLabel}
            className="block min-w-0 before:absolute before:inset-0 before:z-10 focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-inset"
          >
            <p title={project.name} className="truncate font-semibold">
              {project.name}
            </p>
          </Link>
          {project.githubRepository && (
            <DeploymentFailedWarning latest={latestDeployment} />
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[160px] py-3">
        <ProjectRegion region={project.region} />
      </TableCell>
      <TableCell className="max-w-[240px] py-3">
        <ProjectRepository project={project} />
      </TableCell>
      {/* Without a repo the dashboard hides deployments everywhere else,
          so the cell stays empty, like the card. */}
      <TableCell className="py-3">
        {project.githubRepository && (
          <ProjectLastDeployment latest={latestDeployment} />
        )}
      </TableCell>
      <TableCell className="py-3">
        <ProjectStatusPill status={status} />
      </TableCell>
    </TableRow>
  );
}

interface ProjectsTableProps {
  projects: Project[];
}

export default function ProjectsTable({ projects }: ProjectsTableProps) {
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
      <div className="mx-auto w-full max-w-5xl px-5 py-4">
        <Table
          containerClassName="rounded-lg border bg-background"
          className="min-w-[720px]"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Repository</TableHead>
              <TableHead>Last deployment</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                orgSlug={org?.slug}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
