import { formatDistance } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, Lock, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/v3/avatar';
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
import { ProjectRepository } from '@/features/orgs/components/projects/ProjectRepository';
import type { Project } from '@/features/orgs/components/projects/ProjectsGrid';
import {
  getLatestDeployment,
  type LatestDeployment,
} from '@/features/orgs/components/projects/utils/getLatestDeployment';
import type { PipelineRunInput } from '@/features/orgs/projects/deployments/types';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

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

// Same data as the shared DeploymentStatusMessage, laid out like the account
// menu header: a bigger avatar, the name, and a muted line below. Kept here
// so the project overview, which also uses the shared one, stays as it is.
function ProjectDeployment({ latest }: { latest: LatestDeployment }) {
  const { pipelineRun, deployment } = latest;

  if (!pipelineRun && !deployment) {
    return (
      <span className="whitespace-nowrap text-muted-foreground text-sm">
        No deployments yet
      </span>
    );
  }

  let userName: string | null | undefined;
  let avatarUrl: string | null | undefined;
  let endedAt: string | null | undefined;
  let inProgress: boolean;

  if (pipelineRun) {
    const input = pipelineRun.input as PipelineRunInput | undefined;
    userName = input?.commit_user_name;
    avatarUrl = input?.commit_user_avatar_url;
    endedAt = pipelineRun.endedAt;
    inProgress = ['pending', 'running'].includes(pipelineRun.status as string);
  } else {
    userName = deployment?.commitUserName;
    avatarUrl = deployment?.commitUserAvatarUrl;
    endedAt = deployment?.deploymentEndedAt;
    inProgress = ['SCHEDULED', 'PENDING', 'DEPLOYING'].includes(
      deployment?.deploymentStatus as string,
    );
  }

  const when =
    inProgress || !endedAt
      ? 'updated just now'
      : `deployed ${formatDistance(new Date(endedAt), new Date(), { addSuffix: true })}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        alt={`Avatar of ${userName}`}
        name={userName ?? undefined}
        src={avatarUrl}
        className="h-8 w-8"
      />
      <div className="flex min-w-0 flex-col">
        <span title={userName ?? undefined} className="truncate font-medium">
          {userName}
        </span>
        <span className="truncate text-muted-foreground text-xs">{when}</span>
      </div>
    </div>
  );
}

function ProjectLocked({ reason }: { reason?: string | null }) {
  const pill = (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/40 py-1 pr-2.5 pl-1 text-warning">
      <Lock className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap font-medium text-xs">Locked</span>
    </span>
  );

  if (!reason) {
    return pill;
  }

  // A button above the row link (z-20), so the reason opens without opening
  // the project.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Locked: ${reason}`}
          className="relative z-20 rounded-full bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {pill}
        </button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
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
    // Fixed height (a table row's height acts as a minimum): rows with a
    // deployment (avatar plus two lines) set it, so every row matches them.
    <TableRow className="relative h-[4.375rem] cursor-pointer hover:bg-muted/50">
      <TableCell>
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/orgs/${orgSlug}/projects/${project.subdomain}`}
            aria-label={linkLabel}
            className="block min-w-0 before:absolute before:inset-0 before:z-10 focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-inset"
          >
            <p title={project.name} className="truncate font-bold">
              {project.name}
            </p>
          </Link>
          {project.githubRepository && (
            <DeploymentFailedWarning latest={latestDeployment} />
          )}
        </div>
      </TableCell>
      {/* Without a repo the dashboard hides deployments everywhere else,
          so this cell shows a muted dash instead. */}
      <TableCell>
        {project.githubRepository ? (
          <ProjectDeployment latest={latestDeployment} />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        {project.githubRepository ? (
          <ProjectRepository project={project} />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        <ProjectRegion region={project.region} />
      </TableCell>
      <TableCell className="text-right">
        {project.isLocked ? (
          <ProjectLocked reason={project.isLockedReason} />
        ) : (
          <ProjectStatusPill status={status} />
        )}
      </TableCell>
    </TableRow>
  );
}

type SortKey = 'name' | 'lastDeployment' | 'status';

interface Sort {
  key: SortKey;
  direction: 'asc' | 'desc';
}

// Each column's first click: names A to Z, newest deployment first, and the
// status that needs attention first.
const FIRST_DIRECTION: Record<SortKey, Sort['direction']> = {
  name: 'asc',
  lastDeployment: 'desc',
  status: 'asc',
};

const STATUS_RANK: Partial<Record<ApplicationStatus, number>> = {
  [ApplicationStatus.Errored]: 1,
  [ApplicationStatus.Live]: 2,
  [ApplicationStatus.Unpausing]: 3,
  [ApplicationStatus.Pausing]: 4,
  [ApplicationStatus.Restoring]: 5,
  [ApplicationStatus.Paused]: 6,
};

function statusRank(project: Project) {
  if (project.isLocked) {
    return 0;
  }

  return STATUS_RANK[project.appStates[0]?.stateId as ApplicationStatus] ?? 7;
}

// Projects without a repository or deployment have no date: they always go
// last, whichever direction.
function lastDeploymentTime(project: Project) {
  if (!project.githubRepository) {
    return null;
  }

  const { pipelineRun, deployment } = getLatestDeployment(project);
  const date = pipelineRun?.startedAt ?? deployment?.deploymentStartedAt;

  return date ? new Date(date).getTime() : null;
}

function sortProjects(projects: Project[], { key, direction }: Sort) {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (a: Project, b: Project) => a.name.localeCompare(b.name);

  return [...projects].sort((a, b) => {
    if (key === 'lastDeployment') {
      const aTime = lastDeploymentTime(a);
      const bTime = lastDeploymentTime(b);

      if (aTime === null || bTime === null) {
        if (aTime === bTime) {
          return byName(a, b);
        }

        return aTime === null ? 1 : -1;
      }

      return sign * (aTime - bTime) || byName(a, b);
    }

    if (key === 'status') {
      return sign * (statusRank(a) - statusRank(b)) || byName(a, b);
    }

    return sign * byName(a, b);
  });
}

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: SortableHeadProps) {
  const active = sort.key === sortKey;
  // Sortable headers always show an icon, so they read as clickable: a faint
  // up/down pair at rest, the direction arrow once active.
  const Icon = active
    ? sort.direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead
      className={className}
      aria-sort={
        active
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'group inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-transparent p-0 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon
          aria-hidden
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            !active && 'opacity-50 group-hover:opacity-100',
          )}
        />
      </button>
    </TableHead>
  );
}

interface ProjectsTableProps {
  projects: Project[];
}

export default function ProjectsTable({ projects }: ProjectsTableProps) {
  const { org } = useCurrentOrg();
  const [sort, setSort] = useState<Sort>({
    key: 'lastDeployment',
    direction: 'desc',
  });

  const sortedProjects = useMemo(
    () => sortProjects(projects, sort),
    [projects, sort],
  );

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: FIRST_DIRECTION[key] },
    );
  }

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
          className="min-w-[720px] table-fixed"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead
                label="Name"
                sortKey="name"
                sort={sort}
                onSort={handleSort}
                className="w-[24%]"
              />
              <SortableHead
                label="Last deployment"
                sortKey="lastDeployment"
                sort={sort}
                onSort={handleSort}
                className="w-[26%]"
              />
              <TableHead className="w-[22%]">Repository</TableHead>
              <TableHead className="w-[14%]">Region</TableHead>
              <SortableHead
                label="Status"
                sortKey="status"
                sort={sort}
                onSort={handleSort}
                className="w-[14%] text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => (
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
