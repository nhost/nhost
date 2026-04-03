import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
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
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { useDeployment } from '@/features/orgs/projects/deployments/hooks/useDeployment';
import {
  type DeploymentLog,
  useDeploymentLogs,
} from '@/features/orgs/projects/deployments/hooks/useDeploymentLogs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn, ifNullconvertToUndefined } from '@/lib/utils';

type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';

interface TaskMetadata {
  name: string;
  status: TaskStatus;
  started_at?: string;
  ended_at?: string;
}

interface DeploymentMetadata {
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
  metadata: DeploymentMetadata | undefined,
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

    if (metadata?.tasks) {
      const result: TaskGroup[] = metadata.tasks.map((task) => ({
        name: task.name,
        status: task.status,
        startedAt: task.started_at,
        endedAt: task.ended_at,
        logs: logsMap.get(task.name) ?? [],
      }));

      const metadataNames = new Set(metadata.tasks.map((t) => t.name));
      for (const [name, taskLogs] of logsMap) {
        if (!metadataNames.has(name)) {
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
  }, [logs, metadata]);
}

function DeploymentDetails() {
  const { project } = useProject();
  const { data, error, loading } = useDeployment();

  const deployment = data?.deployment;
  const metadata = (deployment as { metadata?: DeploymentMetadata } | undefined)
    ?.metadata;

  const { data: logsData, loading: logsLoading } = useDeploymentLogs({
    appID: project?.id,
    deploymentID: deployment?.id,
    deploymentStatus: deployment?.deploymentStatus,
    deploymentStartedAt: deployment?.deploymentStartedAt,
    deploymentEndedAt: deployment?.deploymentEndedAt,
  });

  const taskGroups = useTaskGroups(logsData?.getDeploymentLogs, metadata);

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

  if (!deployment) {
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

  const relativeDateOfDeployment = deployment.deploymentStartedAt
    ? formatDistanceToNowStrict(parseISO(deployment.deploymentStartedAt), {
        addSuffix: true,
      })
    : '';

  return (
    <Container>
      <div className="flex justify-between">
        <div>
          <Text variant="h2" component="h1">
            Deployment Details
          </Text>
        </div>
      </div>

      <div className="my-8 flex justify-between">
        <div className="grid grid-flow-col items-center gap-4">
          <Avatar
            alt={ifNullconvertToUndefined(deployment.commitUserName)}
            src={ifNullconvertToUndefined(deployment.commitUserAvatarUrl)}
            className="h-8 w-8"
          >
            {deployment.commitUserName!}
          </Avatar>
          <div>
            <Text>{deployment.commitMessage}</Text>
            <Text color="secondary">{relativeDateOfDeployment}</Text>
          </div>
        </div>
        <div className="flex items-center">
          <Link
            className="self-center font-medium font-mono"
            target="_blank"
            rel="noreferrer"
            href={`https://github.com/${project?.githubRepository?.fullName}/commit/${deployment?.commitSHA}`}
            underline="hover"
          >
            {deployment.commitSHA.substring(0, 7)}
          </Link>
          <div className="w-20 text-right">
            <DeploymentDurationLabel
              startedAt={deployment.deploymentStartedAt}
              endedAt={deployment.deploymentEndedAt}
            />
          </div>
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
