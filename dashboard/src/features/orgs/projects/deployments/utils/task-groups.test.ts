import type { DeploymentLog } from '@/features/orgs/projects/deployments/hooks/useDeploymentLogs';
import {
  buildTaskGroups,
  formatTaskDuration,
  formatTaskName,
  type PipelineRunSubstatus,
} from './task-groups';

function makeLog(
  task: string,
  timestamp: string,
  log = 'some log line',
): DeploymentLog {
  return { task, timestamp, log };
}

describe('formatTaskName', () => {
  it('capitalizes single word', () => {
    expect(formatTaskName('build')).toBe('Build');
  });

  it('capitalizes hyphenated words', () => {
    expect(formatTaskName('run-migrations')).toBe('Run Migrations');
  });

  it('handles multiple hyphens', () => {
    expect(formatTaskName('apply-hasura-metadata')).toBe(
      'Apply Hasura Metadata',
    );
  });

  it('returns empty string for empty input', () => {
    expect(formatTaskName('')).toBe('');
  });
});

describe('formatTaskDuration', () => {
  it('returns null when startedAt is missing', () => {
    expect(formatTaskDuration(undefined, '2024-01-01T10:01:00Z')).toBeNull();
  });

  it('returns null when endedAt is missing', () => {
    expect(formatTaskDuration('2024-01-01T10:00:00Z', undefined)).toBeNull();
  });

  it('returns null when both are missing', () => {
    expect(formatTaskDuration(undefined, undefined)).toBeNull();
  });

  it('formats sub-minute duration in seconds', () => {
    expect(
      formatTaskDuration('2024-01-01T10:00:00Z', '2024-01-01T10:00:45Z'),
    ).toBe('45s');
  });

  it('formats zero duration', () => {
    expect(
      formatTaskDuration('2024-01-01T10:00:00Z', '2024-01-01T10:00:00Z'),
    ).toBe('0s');
  });

  it('formats exactly 60 seconds as minutes', () => {
    expect(
      formatTaskDuration('2024-01-01T10:00:00Z', '2024-01-01T10:01:00Z'),
    ).toBe('1m 0s');
  });

  it('formats multi-minute duration', () => {
    expect(
      formatTaskDuration('2024-01-01T10:00:00Z', '2024-01-01T10:03:25Z'),
    ).toBe('3m 25s');
  });
});

describe('buildTaskGroups', () => {
  describe('empty inputs', () => {
    it('returns empty array when logs and substatus are undefined', () => {
      expect(buildTaskGroups(undefined, undefined)).toEqual([]);
    });

    it('returns empty array when logs is empty and substatus is undefined', () => {
      expect(buildTaskGroups([], undefined)).toEqual([]);
    });

    it('returns groups from substatus even with no logs', () => {
      const substatus: PipelineRunSubstatus = {
        tasks: [
          {
            name: 'build',
            status: 'succeeded',
            started_at: '2024-01-01T10:00:00Z',
            ended_at: '2024-01-01T10:01:00Z',
          },
        ],
      };
      const result = buildTaskGroups([], substatus);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'build',
        status: 'succeeded',
        startedAt: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:01:00Z',
        logs: [],
      });
    });
  });

  describe('logs only (no substatus)', () => {
    it('groups logs by task name', () => {
      const logs = [
        makeLog('build', '2024-01-01T10:00:01Z'),
        makeLog('deploy', '2024-01-01T10:01:00Z'),
        makeLog('build', '2024-01-01T10:00:02Z'),
      ];
      const result = buildTaskGroups(logs, undefined);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('build');
      expect(result[0].logs).toHaveLength(2);
      expect(result[1].name).toBe('deploy');
      expect(result[1].logs).toHaveLength(1);
    });

    it('assigns running status to all groups', () => {
      const logs = [
        makeLog('build', '2024-01-01T10:00:00Z'),
        makeLog('deploy', '2024-01-01T10:01:00Z'),
      ];
      const result = buildTaskGroups(logs, undefined);
      for (const group of result) {
        expect(group.status).toBe('running');
      }
    });

    it('sorts groups by earliest log timestamp', () => {
      const logs = [
        makeLog('deploy', '2024-01-01T10:05:00Z'),
        makeLog('build', '2024-01-01T10:00:00Z'),
      ];
      const result = buildTaskGroups(logs, undefined);
      expect(result[0].name).toBe('build');
      expect(result[1].name).toBe('deploy');
    });

    it('sorts logs within a group by timestamp', () => {
      const logs = [
        makeLog('build', '2024-01-01T10:00:03Z', 'third'),
        makeLog('build', '2024-01-01T10:00:01Z', 'first'),
        makeLog('build', '2024-01-01T10:00:02Z', 'second'),
      ];
      const result = buildTaskGroups(logs, undefined);
      expect(result[0].logs[0].log).toBe('first');
      expect(result[0].logs[1].log).toBe('second');
      expect(result[0].logs[2].log).toBe('third');
    });
  });

  describe('with substatus', () => {
    it('maps substatus tasks to groups with metadata', () => {
      const substatus: PipelineRunSubstatus = {
        tasks: [
          {
            name: 'build',
            status: 'succeeded',
            started_at: '2024-01-01T10:00:00Z',
            ended_at: '2024-01-01T10:01:00Z',
          },
          {
            name: 'deploy',
            status: 'running',
            started_at: '2024-01-01T10:01:00Z',
          },
        ],
      };
      const logs = [
        makeLog('build', '2024-01-01T10:00:30Z', 'build log'),
        makeLog('deploy', '2024-01-01T10:01:05Z', 'deploy log'),
      ];
      const result = buildTaskGroups(logs, substatus);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'build',
        status: 'succeeded',
        startedAt: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:01:00Z',
      });
      expect(result[0].logs).toHaveLength(1);
      expect(result[1]).toMatchObject({
        name: 'deploy',
        status: 'running',
        startedAt: '2024-01-01T10:01:00Z',
      });
      expect(result[1].logs).toHaveLength(1);
    });

    it('includes orphaned logs as running groups', () => {
      const substatus: PipelineRunSubstatus = {
        tasks: [
          {
            name: 'build',
            status: 'succeeded',
            started_at: '2024-01-01T10:00:00Z',
            ended_at: '2024-01-01T10:01:00Z',
          },
        ],
      };
      const logs = [
        makeLog('build', '2024-01-01T10:00:30Z'),
        makeLog('unknown-task', '2024-01-01T10:02:00Z'),
      ];
      const result = buildTaskGroups(logs, substatus);
      expect(result).toHaveLength(2);
      const orphan = result.find((g) => g.name === 'unknown-task');
      expect(orphan).toBeDefined();
      expect(orphan?.status).toBe('running');
      expect(orphan?.logs).toHaveLength(1);
    });

    it('sorts groups by startedAt, with missing startedAt last', () => {
      const substatus: PipelineRunSubstatus = {
        tasks: [
          {
            name: 'deploy',
            status: 'running',
            started_at: '2024-01-01T10:02:00Z',
          },
          { name: 'pending-task', status: 'pending' },
          {
            name: 'build',
            status: 'succeeded',
            started_at: '2024-01-01T10:00:00Z',
            ended_at: '2024-01-01T10:01:00Z',
          },
        ],
      };
      const result = buildTaskGroups([], substatus);
      expect(result[0].name).toBe('build');
      expect(result[1].name).toBe('deploy');
      expect(result[2].name).toBe('pending-task');
    });

    it('assigns empty logs to tasks with no matching log entries', () => {
      const substatus: PipelineRunSubstatus = {
        tasks: [
          {
            name: 'build',
            status: 'pending',
            started_at: '2024-01-01T10:00:00Z',
          },
        ],
      };
      const result = buildTaskGroups([], substatus);
      expect(result[0].logs).toEqual([]);
    });
  });
});
