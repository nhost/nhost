import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '@/components/layout/Container';
import type { DeploymentStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Avatar } from '@/components/ui/v3/avatar';
import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { DeploymentServiceLogs } from '@/features/orgs/projects/deployments/components/DeploymentServiceLogs';
import { useDeployment } from '@/features/orgs/projects/deployments/hooks/useDeployment';
import {
  type DeploymentLog,
  useDeploymentLogs,
} from '@/features/orgs/projects/deployments/hooks/useDeploymentLogs';
import type { PipelineRunInput } from '@/features/orgs/projects/deployments/types';
import {
  buildTaskGroups,
  formatTaskDuration,
  formatTaskName,
  type PipelineRunSubstatus,
  type TaskGroup,
  type TaskStatus,
} from '@/features/orgs/projects/deployments/utils/task-groups';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import type {
  DeploymentFragment,
  PipelineRunFragment,
} from '@/utils/__generated__/graphql';

// --- Pipeline Run Detail Types ---

type PipelineRunStatusValue =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'aborted';

function StatusBadge({ status }: { status: PipelineRunStatusValue }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium';
  switch (status) {
    case 'running':
      return (
        <span className={cn(base, 'bg-blue-500/10 text-blue-500')}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
          Running
        </span>
      );
    case 'pending':
      return (
        <span className={cn(base, 'bg-yellow-500/10 text-yellow-500')}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
          Pending
        </span>
      );
    case 'succeeded':
      return (
        <span className={cn(base, 'bg-green-500/10 text-green-500')}>
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Succeeded
        </span>
      );
    case 'failed':
      return (
        <span className={cn(base, 'bg-red-500/10 text-red-500')}>
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Failed
        </span>
      );
    case 'aborted':
      return (
        <span className={cn(base, 'bg-gray-500/10 text-gray-400')}>
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
          Aborted
        </span>
      );
    default:
      return null;
  }
}

function TaskStatusIndicator({ status }: { status: TaskStatus }) {
  const base = 'h-2 w-2 rounded-full';
  switch (status) {
    case 'running':
      return <span className={cn(base, 'animate-pulse bg-blue-500')} />;
    case 'pending':
      return <span className={cn(base, 'animate-pulse bg-yellow-500')} />;
    case 'succeeded':
      return <span className={cn(base, 'bg-green-500')} />;
    case 'failed':
      return <span className={cn(base, 'bg-red-500')} />;
    default:
      return <span className={cn(base, 'bg-gray-400')} />;
  }
}

function TaskLogList({ logs }: { logs: DeploymentLog[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(logs.length);

  useEffect(() => {
    if (logs.length > prevLengthRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLengthRef.current = logs.length;
  }, [logs.length]);

  return (
    <div
      ref={containerRef}
      className="max-h-64 overflow-x-auto overflow-y-scroll"
    >
      {logs.map((log, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: logs are append-only and timestamps can collide, so index disambiguates
        <div key={`${log.timestamp}-${index}`} className="flex font-mono">
          <div className="mr-2 flex-shrink-0 text-white/60">
            {format(parseISO(log.timestamp), 'HH:mm:ss')}
          </div>
          <div className="whitespace-pre">{log.log}</div>
        </div>
      ))}
    </div>
  );
}

function useTaskGroups(
  logs: DeploymentLog[] | undefined,
  substatus: PipelineRunSubstatus | undefined,
): TaskGroup[] {
  return useMemo(() => buildTaskGroups(logs, substatus), [logs, substatus]);
}

// --- Pipeline Run Detail View ---

function PipelineRunDetails({
  pipelineRun,
}: {
  pipelineRun: PipelineRunFragment;
}) {
  const { project } = useProject();

  const input = pipelineRun.input as PipelineRunInput | undefined;
  const substatus = pipelineRun.substatus as PipelineRunSubstatus | undefined;

  const { data: logsData, loading: logsLoading } = useDeploymentLogs({
    appID: project?.id,
    pipelineRunID: pipelineRun?.id,
    status: pipelineRun?.status,
    startedAt: pipelineRun?.startedAt,
    endedAt: pipelineRun?.endedAt,
  });

  const taskGroups = useTaskGroups(logsData?.getPipelineRunLogs, substatus);

  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const seenTasks = useRef(new Set<string>());

  useEffect(() => {
    const newTasks = taskGroups
      .filter((g) => g.status !== 'pending' && !seenTasks.current.has(g.name))
      .map((g) => g.name);

    for (const name of newTasks) {
      seenTasks.current.add(name);
    }

    if (newTasks.length > 0) {
      setExpandedTasks((prev) => [...prev, ...newTasks]);
    }
  }, [taskGroups]);

  return (
    <Container>
      <div className="flex justify-between">
        <div>
          <h1 className="font-medium text-2xl">Deployment Details</h1>
        </div>
      </div>

      <div className="my-8 grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
        <div>
          <p className="text-muted-foreground text-xs">Status</p>
          <div className="mt-1">
            <StatusBadge
              status={pipelineRun.status as PipelineRunStatusValue}
            />
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Commit</p>
          <div className="mt-0.5">
            <TextLink
              className="font-medium font-mono text-sm"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://github.com/${project?.githubRepository?.fullName}/commit/${input?.commit_sha}`}
            >
              {input?.commit_sha?.substring(0, 7)}
            </TextLink>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="line-clamp-1 cursor-default text-muted-foreground text-sm">
                  {input?.commit_message}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                {input?.commit_message}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Author</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Avatar
              alt={input?.commit_user_name ?? undefined}
              name={input?.commit_user_name ?? undefined}
              src={input?.commit_user_avatar_url}
              className="h-5 w-5"
            />
            <span className="truncate text-sm">{input?.commit_user_name}</span>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Started at</p>
          <p className="mt-0.5 text-sm">
            {pipelineRun.startedAt
              ? format(parseISO(pipelineRun.startedAt), 'MMM d, HH:mm:ss')
              : '-'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Ended at</p>
          <p className="mt-0.5 text-sm">
            {pipelineRun.endedAt
              ? format(parseISO(pipelineRun.endedAt), 'MMM d, HH:mm:ss')
              : '-'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Duration</p>
          <p className="mt-0.5 font-medium text-sm">
            <DeploymentDurationLabel
              startedAt={pipelineRun.startedAt}
              endedAt={pipelineRun.endedAt}
            />
          </p>
        </div>
      </div>

      <div>
        <div className="rounded-lg bg-[#0e1827] p-4 text-sm- text-white dark:bg-[#10151e]">
          {logsLoading && taskGroups.length === 0 && (
            <span className="font-mono">Loading logs...</span>
          )}

          {!logsLoading && taskGroups.length === 0 && (
            <span className="font-mono">No logs available.</span>
          )}

          {taskGroups.length > 0 && (
            <Accordion
              type="multiple"
              value={expandedTasks}
              onValueChange={setExpandedTasks}
            >
              {taskGroups.map((group) => (
                <AccordionItem
                  key={group.name}
                  value={group.name}
                  className="border-white/20"
                >
                  <AccordionTrigger className="py-2 text-white hover:no-underline">
                    <div className="flex items-center gap-2">
                      <TaskStatusIndicator status={group.status} />
                      <span>{formatTaskName(group.name)}</span>
                      {group.startedAt && (
                        <span className="text-white/40 text-xs">
                          {formatTaskDuration(group.startedAt, group.endedAt)}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    {group.logs.length === 0 ? (
                      <span className="font-mono text-white/40">
                        Waiting...
                      </span>
                    ) : (
                      <TaskLogList logs={group.logs} />
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>

      {taskGroups.some(
        (g) => g.name === 'project-config' && g.status === 'failed',
      ) && (
        <div className="mt-6">
          <DeploymentServiceLogs
            from={pipelineRun.startedAt}
            to={pipelineRun.endedAt}
          />
        </div>
      )}
    </Container>
  );
}

// --- Legacy Deployment Detail View (deprecated) ---

function LegacyDeploymentDetailsView({
  deployment,
}: {
  deployment: DeploymentFragment;
}) {
  const { project } = useProject();

  const relativeDateOfDeployment = deployment.deploymentStartedAt
    ? formatDistanceToNowStrict(parseISO(deployment.deploymentStartedAt), {
        addSuffix: true,
      })
    : '';

  return (
    <Container>
      <div className="flex justify-between">
        <div>
          <h1 className="font-medium text-2xl">Deployment Details</h1>
        </div>
        <div className="flex space-x-8">
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.migrationsStatus as DeploymentStatus}
            />
            <span className="text-sm+">Database Migrations</span>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.metadataStatus as DeploymentStatus}
            />
            <span className="text-sm+">Hasura Metadata</span>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.functionsStatus as DeploymentStatus}
            />
            <span className="text-sm+">Serverless Functions</span>
          </div>
        </div>
      </div>
      <div className="my-8 flex justify-between">
        <div className="grid grid-flow-col items-center gap-4">
          <Avatar
            alt={deployment.commitUserName ?? undefined}
            name={deployment.commitUserName ?? undefined}
            src={deployment.commitUserAvatarUrl}
            className="h-8 w-8"
          />

          <div>
            <p className="text-sm+">{deployment.commitMessage}</p>
            <p className="text-muted-foreground text-sm+">
              {relativeDateOfDeployment}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <TextLink
            className="self-center font-medium font-mono"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://github.com/${project?.githubRepository?.fullName}/commit/${deployment?.commitSHA}`}
          >
            {deployment.commitSHA.substring(0, 7)}
          </TextLink>

          <div className="w-20 text-right">
            <DeploymentDurationLabel
              startedAt={deployment.deploymentStartedAt}
              endedAt={deployment.deploymentEndedAt}
            />
          </div>
        </div>
      </div>
      <div>
        <div className="rounded-lg bg-[#0e1827] p-4 text-sm- text-white dark:bg-[#10151e]">
          {deployment.deploymentLogs.length === 0 && (
            <span className="font-mono">No message.</span>
          )}

          {deployment.deploymentLogs.map((log) => (
            <div key={log.id} className="flex font-mono">
              <div className="mr-2 flex-shrink-0">
                {format(parseISO(log.createdAt), 'HH:mm:ss')}:
              </div>
              <div className="break-all">{log.message}</div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

// --- Main Component (routes to either view) ---

function DeploymentDetails() {
  const { data, loading, error, legacyDeployment, legacyLoading, legacyError } =
    useDeployment();

  if (loading || legacyLoading) {
    return (
      <Container>
        <Spinner size="xs" wrapperClassName="flex-row gap-1.5">
          <span className="text-muted-foreground text-xs">
            Loading deployment...
          </span>
        </Spinner>
      </Container>
    );
  }

  if (data?.pipelineRun) {
    return <PipelineRunDetails pipelineRun={data.pipelineRun} />;
  }

  if (legacyDeployment) {
    return <LegacyDeploymentDetailsView deployment={legacyDeployment} />;
  }

  if (error || legacyError) {
    throw error ?? legacyError;
  }

  return (
    <Container>
      <h1 className="font-semibold text-4xl">Not found</h1>
      <p className="text-disabled text-sm">This deployment does not exist.</p>
    </Container>
  );
}

export default DeploymentDetails;
