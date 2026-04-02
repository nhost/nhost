import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Container } from '@/components/layout/Container';
import type { DeploymentStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
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
import { DeploymentServiceLogs } from '@/features/orgs/projects/deployments/components/DeploymentServiceLogs';
import { useDeployment } from '@/features/orgs/projects/deployments/hooks/useDeployment';
import {
  type DeploymentLog,
  useDeploymentLogs,
} from '@/features/orgs/projects/deployments/hooks/useDeploymentLogs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ifNullconvertToUndefined } from '@/lib/utils';

function formatTaskName(task: string): string {
  return task
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function useTaskGroups(logs: DeploymentLog[] | undefined) {
  return useMemo(() => {
    if (!logs || logs.length === 0) {
      return [];
    }

    const groups = new Map<string, DeploymentLog[]>();
    for (const log of logs) {
      const existing = groups.get(log.task) ?? [];
      existing.push(log);
      groups.set(log.task, existing);
    }

    for (const groupLogs of groups.values()) {
      groupLogs.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    }

    return Array.from(groups.entries()).sort(
      ([, a], [, b]) =>
        new Date(a[0].timestamp).getTime() - new Date(b[0].timestamp).getTime(),
    );
  }, [logs]);
}

function DeploymentDetails() {
  const { project } = useProject();
  const { data, error, loading } = useDeployment();

  const deployment = data?.deployment;

  const { data: logsData, loading: logsLoading } = useDeploymentLogs({
    appID: project?.id,
    deploymentID: deployment?.id,
    deploymentStatus: deployment?.deploymentStatus,
    deploymentStartedAt: deployment?.deploymentStartedAt,
    deploymentEndedAt: deployment?.deploymentEndedAt,
  });

  const taskGroups = useTaskGroups(logsData?.getDeploymentLogs);

  const taskNames = useMemo(
    () => taskGroups.map(([task]) => task),
    [taskGroups],
  );

  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);

  useEffect(() => {
    setExpandedTasks((prev) => {
      const newTasks = taskNames.filter((name) => !prev.includes(name));
      return newTasks.length > 0 ? [...prev, ...newTasks] : prev;
    });
  }, [taskNames]);

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
        <div className="flex space-x-8">
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.migrationsStatus as DeploymentStatus}
            />
            <Text>Database Migrations</Text>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.metadataStatus as DeploymentStatus}
            />
            <Text>Hasura Metadata</Text>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.functionsStatus as DeploymentStatus}
            />
            <Text>Serverless Functions</Text>
          </div>
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
              {taskGroups.map(([task, logs]) => (
                <AccordionItem
                  key={task}
                  value={task}
                  className="border-white/20"
                >
                  <AccordionTrigger className="py-2 text-white hover:no-underline">
                    {formatTaskName(task)}
                  </AccordionTrigger>
                  <AccordionContent className="overflow-x-auto pb-2">
                    {logs.map((log, index) => (
                      <div
                        key={`${log.timestamp}-${index}`}
                        className="flex font-mono"
                      >
                        <div className="mr-2 flex-shrink-0 text-white/60">
                          {format(parseISO(log.timestamp), 'HH:mm:ss')}
                        </div>
                        <div className="whitespace-pre">{log.log}</div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Box>
      </div>

      {project?.id && deployment.deploymentStartedAt && (
        <DeploymentServiceLogs
          from={deployment.deploymentStartedAt}
          to={deployment.deploymentEndedAt ?? null}
        />
      )}
    </Container>
  );
}

export default DeploymentDetails;
