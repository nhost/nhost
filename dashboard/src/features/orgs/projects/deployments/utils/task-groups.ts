import type { DeploymentLog } from '@/features/orgs/projects/deployments/hooks/useDeploymentLogs';

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface TaskMetadata {
  name: string;
  status: TaskStatus;
  started_at?: string;
  ended_at?: string;
}

export interface PipelineRunSubstatus {
  tasks?: TaskMetadata[];
}

export interface TaskGroup {
  name: string;
  status: TaskStatus;
  startedAt?: string;
  endedAt?: string;
  logs: DeploymentLog[];
}

export function formatTaskName(task: string): string {
  return task
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatTaskDuration(
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

export function buildTaskGroups(
  logs: DeploymentLog[] | undefined,
  substatus: PipelineRunSubstatus | undefined,
): TaskGroup[] {
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
      return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    });

    return result;
  }

  if (!logs || logs.length === 0) {
    return [];
  }

  return Array.from(logsMap.entries())
    .sort(
      ([, a], [, b]) =>
        new Date(a[0].timestamp).getTime() - new Date(b[0].timestamp).getTime(),
    )
    .map(([name, taskLogs]) => ({
      name,
      status: 'running' as const,
      logs: taskLogs,
    }));
}
