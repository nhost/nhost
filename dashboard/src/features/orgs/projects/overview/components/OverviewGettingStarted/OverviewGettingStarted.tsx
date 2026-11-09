import { startOfDay, startOfMonth } from 'date-fns';
import { CheckIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
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
  done: boolean;
  href?: string;
  onClick?: () => void;
}

function StepRow({ step }: { step: Step }) {
  const content: ReactNode = (
    <>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
          step.done
            ? 'border-success bg-success text-background'
            : 'border-border',
        )}
      >
        {step.done && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'font-medium text-sm',
            step.done && 'text-muted-foreground line-through',
          )}
        >
          {step.title}
        </span>
        <span className="text-muted-foreground text-xs">
          {step.description}
        </span>
      </span>
      {!step.done && (
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </>
  );

  const className =
    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50';

  if (step.onClick && !step.done) {
    return (
      <li className="border-b last:border-b-0">
        <button type="button" onClick={step.onClick} className={className}>
          {content}
        </button>
      </li>
    );
  }

  return (
    <li className="border-b last:border-b-0">
      <Link href={step.href ?? '#'} className={className}>
        {content}
      </Link>
    </li>
  );
}

/**
 * A small helper for new projects. It never hides anything else on the
 * page: it sits on top, goes away once every step is done, and anyone can
 * close it.
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
      done: hasOwnTable,
      href: `${projectPath}/database/browser/default`,
    },
    {
      id: 'user',
      title: 'Add your first user',
      description: 'Sign up from your app, or create one in Auth › Users',
      done: (userMetrics?.allUsers?.aggregate?.count ?? 0) > 0,
      href: `${projectPath}/auth/users`,
    },
    {
      id: 'github',
      title: 'Connect a GitHub repository',
      description: 'Deploy migrations and functions on every push',
      done: !!project.githubRepository,
      onClick: openGitHubModal,
    },
    {
      id: 'team',
      title: 'Invite your team',
      description: 'Work on this project together',
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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-lg">Getting started</h2>
        <Button
          variant="subtle"
          onClick={dismiss}
          aria-label="Hide getting started"
        >
          <XIcon />
        </Button>
      </div>

      <ul className="overflow-hidden rounded-lg border shadow-sm">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </ul>
    </section>
  );
}
