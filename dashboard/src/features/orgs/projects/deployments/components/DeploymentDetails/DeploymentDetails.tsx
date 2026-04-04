import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { useDeployment } from '@/features/orgs/projects/deployments/hooks/useDeployment';
import {
  type DeploymentLog,
  useDeploymentLogs,
} from '@/features/orgs/projects/deployments/hooks/useDeploymentLogs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn, ifNullconvertToUndefined } from '@/lib/utils';
import type { PipelineRunInput } from '@/features/orgs/projects/deployments/types';

type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';
type PipelineRunStatusValue =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'aborted';

interface TaskMetadata {
  name: string;
  status: TaskStatus;
  started_at?: string;
  ended_at?: string;
}

interface PipelineRunSubstatus {
  tasks?: TaskMetadata[];
}

interface TaskGroup {
  name: string;
  status: TaskStatus;
  startedAt?: string;
  endedAt?: string;
  logs: DeploymentLog[];
}

function formatTaskName(task: string): string {
  return task
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTaskDuration(
  startedAt?: string,
  endedAt?: string,
): string | null {
  if (!startedAt || !endedAt) {
    return null;
  }
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

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
  const baseClasses = 'h-2 w-2 rounded-full';
  switch (status) {
    case 'running':
      return <span className={cn(baseClasses, 'animate-pulse bg-blue-500')} />;
    case 'succeeded':
      return <span className={cn(baseClasses, 'bg-green-500')} />;
    case 'failed':
      return <span className={cn(baseClasses, 'bg-red-500')} />;
    default:
      return <span className={cn(baseClasses, 'bg-gray-400')} />;
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
  return useMemo(() => {
    const logsMap = new Map<string, DeploymentLog[]>();
    for (const log of logs ?? []) {
      const existing = logsMap.get(log.task) ?? [];
      existing.push(log);
      logsMap.set(log.task, existing);
    }

    for (const groupLogs of logsMap.values()) {
      groupLogs.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    }

    if (substatus?.tasks) {
      const result: TaskGroup[] = substatus.tasks.map((task) => ({
        name: task.name,
        status: task.status,
        startedAt: task.started_at,
        endedAt: task.ended_at,
        logs: logsMap.get(task.name) ?? [],
      }));

      const substatusNames = new Set(substatus.tasks.map((t) => t.name));
      for (const [name, taskLogs] of logsMap) {
        if (!substatusNames.has(name)) {
          result.push({ name, status: 'running', logs: taskLogs });
        }
      }

      result.sort((a, b) => {
        if (!a.startedAt) {
          return 1;
        }
        if (!b.startedAt) {
          return -1;
        }
        return (
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        );
      });

      return result;
    }

    if (!logs || logs.length === 0) {
      return [];
    }

    return Array.from(logsMap.entries())
      .sort(
        ([, a], [, b]) =>
          new Date(a[0].timestamp).getTime() -
          new Date(b[0].timestamp).getTime(),
      )
      .map(([name, taskLogs]) => ({
        name,
        status: 'running' as const,
        logs: taskLogs,
      }));
  }, [logs, substatus]);
}

function DeploymentDetails() {
  const { project } = useProject();
  const { data, error, loading } = useDeployment();

  const pipelineRun = data?.pipelineRun;
  const input = pipelineRun?.input as PipelineRunInput | undefined;
  const substatus = pipelineRun?.substatus as PipelineRunSubstatus | undefined;

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

  if (loading) {
    return (
      <Container>
        <ActivityIndicator delay={500} label="Loading deployment..." />
      </Container>
    );
  }

  if (error) {
    throw error;
  }

  if (!pipelineRun) {
    return (
      <Container>
        <Text variant="h1" className="text font-semibold text-4xl">
          Not found
        </Text>
        <Text className="text-sm" color="disabled">
          This deployment does not exist.
        </Text>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex justify-between">
        <div>
          <Text variant="h2" component="h1">
            Deployment Details
          </Text>
        </div>
      </div>

      <div className="my-8 grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
        <div>
          <Text className="text-xs" color="secondary">
            Status
          </Text>
          <div className="mt-1">
            <StatusBadge
              status={pipelineRun.status as PipelineRunStatusValue}
            />
          </div>
        </div>
        <div>
          <Text className="text-xs" color="secondary">
            Commit
          </Text>
          <div className="mt-0.5">
            <Link
              className="font-medium font-mono text-sm"
              target="_blank"
              rel="noreferrer"
              href={`https://github.com/${project?.githubRepository?.fullName}/commit/${input?.commit_sha}`}
              underline="hover"
            >
              {input?.commit_sha?.substring(0, 7)}
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Text
                  className="line-clamp-1 cursor-default text-sm"
                  color="secondary"
                >
                  {input?.commit_message}
                </Text>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                {input?.commit_message}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div>
          <Text className="text-xs" color="secondary">
            Author
          </Text>
          <div className="mt-1 flex items-center gap-1.5">
            <Avatar
              alt={ifNullconvertToUndefined(input?.commit_user_name)}
              src={ifNullconvertToUndefined(input?.commit_user_avatar_url)}
              className="h-5 w-5"
            >
              {input?.commit_user_name ?? ''}
            </Avatar>
            <Text className="truncate text-sm">{input?.commit_user_name}</Text>
          </div>
        </div>
        <div>
          <Text className="text-xs" color="secondary">
            Started at
          </Text>
          <Text className="mt-0.5 text-sm">
            {pipelineRun.startedAt
              ? format(parseISO(pipelineRun.startedAt), 'MMM d, HH:mm:ss')
              : '-'}
          </Text>
        </div>
        <div>
          <Text className="text-xs" color="secondary">
            Ended at
          </Text>
          <Text className="mt-0.5 text-sm">
            {pipelineRun.endedAt
              ? format(parseISO(pipelineRun.endedAt), 'MMM d, HH:mm:ss')
              : '-'}
          </Text>
        </div>
        <div>
          <Text className="text-xs" color="secondary">
            Duration
          </Text>
          <Text className="mt-0.5 font-medium text-sm">
            <DeploymentDurationLabel
              startedAt={pipelineRun.startedAt}
              endedAt={pipelineRun.endedAt}
            />
          </Text>
        </div>
      </div>

      <div>
        <Box
          className="rounded-lg p-4 text-sm-"
          sx={{
            color: 'common.white',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.100' : 'grey.800',
          }}
        >
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
        </Box>
      </div>
    </Container>
  );
}

export default DeploymentDetails;
