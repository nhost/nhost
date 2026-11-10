import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { startOfDay, startOfMonth } from 'date-fns';
import {
  CircleCheckIcon,
  TableIcon,
  UserIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetUserProjectMetricsQuery } from '@/generated/graphql';
import { cn } from '@/lib/utils';

// Tables Nhost creates for Auth and Storage don't count as "your" first table.
const SYSTEM_SCHEMAS = ['auth', 'storage'];

const getDismissedKey = (projectId: string) =>
  `nhost:overview:getting-started-dismissed:${projectId}`;

function readDismissed(projectId: string) {
  try {
    return window.localStorage.getItem(getDismissedKey(projectId)) === 'true';
  } catch {
    return false;
  }
}

function writeDismissed(projectId: string) {
  try {
    window.localStorage.setItem(getDismissedKey(projectId), 'true');
  } catch {
    // Private mode or blocked storage: it just shows again next time.
  }
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  done: boolean;
  href?: string;
  onClick?: () => void;
}

function StepCard({ step }: { step: Step }) {
  const Icon = step.done ? CircleCheckIcon : step.icon;

  // Open steps are white cards with a light primary stroke; done steps get a
  // light success tint so it's clear at a glance what's left.
  const className = cn(
    'flex h-full w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors',
    step.done
      ? 'border-success/25 bg-success/[0.08]'
      : 'border-primary/15 bg-background/70 hover:border-primary/35 hover:bg-primary/[0.08]',
  );

  const content: ReactNode = (
    <>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background',
          step.done ? 'text-success' : 'text-primary',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            'font-medium text-sm',
            step.done && 'text-muted-foreground',
          )}
        >
          {step.title}
        </span>
        <span className="text-muted-foreground text-xs">
          {step.description}
        </span>
      </span>
    </>
  );

  if (step.done) {
    return (
      <li>
        <div className={className}>{content}</div>
      </li>
    );
  }

  if (step.onClick) {
    return (
      <li>
        <button type="button" onClick={step.onClick} className={className}>
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link href={step.href ?? '#'} className={className}>
        {content}
      </Link>
    </li>
  );
}

/**
 * A small helper for new projects, across the full width right under the
 * title so it reads as "do this first". It never hides anything else on the
 * page, goes away once every step is done, and anyone can close it.
 */
export default function OverviewGettingStarted() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { openGitHubModal } = useGitHubModal();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (project?.id) {
      setDismissed(readDismissed(project.id));
    }
  }, [project?.id]);

  const { data: metadata, isLoading: metadataLoading } = useGetMetadata();
  const { data: userMetrics, loading: usersLoading } =
    useGetUserProjectMetricsQuery({
      client: remoteProjectGQLClient,
      variables: {
        startOfMonth: startOfMonth(new Date()),
        today: startOfDay(new Date()),
      },
      skip: !project,
    });

  if (!project || !org || dismissed || metadataLoading || usersLoading) {
    return null;
  }

  const projectPath = `/orgs/${org.slug}/projects/${project.subdomain}`;
  const hasOwnTable = !!metadata?.sources?.some((source) =>
    source.tables?.some(
      (table) => !SYSTEM_SCHEMAS.includes(table.table.schema ?? ''),
    ),
  );

  const steps: Step[] = [
    {
      id: 'table',
      title: 'Create your first table',
      description: 'Add a table in the Database editor',
      icon: TableIcon,
      done: hasOwnTable,
      href: `${projectPath}/database/browser/default`,
    },
    {
      id: 'user',
      title: 'Add your first user',
      description: 'Sign up from your app, or create one in Auth › Users',
      icon: UserIcon,
      done: (userMetrics?.allUsers?.aggregate?.count ?? 0) > 0,
      href: `${projectPath}/auth/users`,
    },
    {
      id: 'github',
      title: 'Connect a GitHub repository',
      description: 'Deploy migrations and functions on every push',
      icon: GitHubIcon,
      done: !!project.githubRepository,
      onClick: openGitHubModal,
    },
    {
      id: 'team',
      title: 'Invite your team',
      description: 'Work on this project together',
      icon: UserPlusIcon,
      done: (org.members?.length ?? 0) > 1,
      href: `/orgs/${org.slug}/members`,
    },
  ];

  if (steps.every((step) => step.done)) {
    return null;
  }

  function dismiss() {
    if (project?.id) {
      writeDismissed(project.id);
    }
    setDismissed(true);
  }

  return (
    <section className="mb-5 flex flex-col gap-4 rounded-lg border border-primary/30 bg-primary/5 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-lg">Getting started</h2>
        {/* The icon button is taller than the heading; the negative margin
            keeps the header at the heading's height. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="subtle"
              className="-my-1 -mr-1"
              onClick={dismiss}
              aria-label="Hide getting started. It won't show up again"
            >
              <XIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Hide. It won&apos;t show up again</TooltipContent>
        </Tooltip>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <StepCard key={step.id} step={step} />
        ))}
      </ul>
    </section>
  );
}
