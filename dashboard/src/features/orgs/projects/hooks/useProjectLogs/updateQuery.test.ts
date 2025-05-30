import type { GetProjectLogsQuery } from '@/utils/__generated__/graphql';
import { updateQuery } from './useProjectLogs';

// Mock log data helper
const createMockLog = (
  timestamp: string,
  id: string = Math.random().toString(),
) => ({
  timestamp,
  log: `Log message ${id}`,
  service: 'test-service',
});

describe('updateQuery', () => {
  describe('when subscription data is missing', () => {
    it('should return previous query when subscriptionData.data is null', () => {
      const prev: GetProjectLogsQuery = {
        logs: [createMockLog('2024-01-01T10:00:00Z')],
      };

      const result = updateQuery(prev, {
        subscriptionData: { data: null as any },
      });

      expect(result).toBe(prev);
    });

    it('should return previous query when subscriptionData.data is undefined', () => {
      const prev: GetProjectLogsQuery = {
        logs: [createMockLog('2024-01-01T10:00:00Z')],
      };

      const result = updateQuery(prev, {
        subscriptionData: { data: undefined as any },
      });

      expect(result).toBe(prev);
    });
  });

  describe('when previous logs are empty', () => {
    it('should return subscription data when prev.logs is null', () => {
      const prev: GetProjectLogsQuery = {
        logs: null as any,
      };

      const subscriptionData = {
        logs: [createMockLog('2024-01-01T10:00:00Z')],
      };

      const result = updateQuery(prev, {
        subscriptionData: { data: subscriptionData },
      });

      expect(result).toEqual(subscriptionData);
    });

    it('should return subscription data when prev.logs is undefined', () => {
      const prev: GetProjectLogsQuery = {
        logs: undefined as any,
      };

      const subscriptionData = {
        logs: [createMockLog('2024-01-01T10:00:00Z')],
      };

      const result = updateQuery(prev, {
        subscriptionData: { data: subscriptionData },
      });

      expect(result).toEqual(subscriptionData);
    });

    it('should return subscription data when prev.logs is empty array', () => {
      const prev: GetProjectLogsQuery = {
        logs: [],
      };

      const subscriptionData = {
        logs: [createMockLog('2024-01-01T10:00:00Z')],
      };

      const result = updateQuery(prev, {
        subscriptionData: { data: subscriptionData },
      });

      expect(result).toEqual(subscriptionData);
    });
  });

  describe('normal log merging scenarios', () => {
    it('should add all new logs when they are all newer than existing logs', () => {
      const prev: GetProjectLogsQuery = {
        logs: [
          createMockLog('2024-01-01T10:00:00Z', 'log1'),
          createMockLog('2024-01-01T11:00:00Z', 'log2'),
        ],
      };

      const newLogs = [
        createMockLog('2024-01-01T12:00:00Z', 'log3'),
        createMockLog('2024-01-01T13:00:00Z', 'log4'),
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      expect(result.logs).toHaveLength(4);
      expect(result.logs).toEqual([...prev.logs, ...newLogs]);
    });

    it('should filter out all new logs when they are all older than existing logs', () => {
      const prev: GetProjectLogsQuery = {
        logs: [
          createMockLog('2024-01-01T10:00:00Z', 'log1'),
          createMockLog('2024-01-01T11:00:00Z', 'log2'),
        ],
      };

      const newLogs = [
        createMockLog('2024-01-01T08:00:00Z', 'log3'),
        createMockLog('2024-01-01T09:00:00Z', 'log4'),
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      expect(result.logs).toHaveLength(2);
      expect(result.logs).toEqual(prev.logs);
    });

    it('should add only newer logs when new logs have mixed timestamps', () => {
      const prev: GetProjectLogsQuery = {
        logs: [
          createMockLog('2024-01-01T10:00:00Z', 'log1'),
          createMockLog('2024-01-01T11:00:00Z', 'log2'),
        ],
      };

      const newLogs = [
        createMockLog('2024-01-01T09:00:00Z', 'log3'), // older - should be filtered out
        createMockLog('2024-01-01T12:00:00Z', 'log4'), // newer - should be added
        createMockLog('2024-01-01T08:00:00Z', 'log5'), // older - should be filtered out
        createMockLog('2024-01-01T13:00:00Z', 'log6'), // newer - should be added
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      expect(result.logs).toHaveLength(4);
      expect(result.logs).toEqual([
        ...prev.logs,
        createMockLog('2024-01-01T12:00:00Z', 'log4'),
        createMockLog('2024-01-01T13:00:00Z', 'log6'),
      ]);
    });

    it('should filter out logs with duplicate timestamps', () => {
      const prev: GetProjectLogsQuery = {
        logs: [
          createMockLog('2024-01-01T10:00:00Z', 'log1'),
          createMockLog('2024-01-01T11:00:00Z', 'log2'),
        ],
      };

      const newLogs = [
        createMockLog('2024-01-01T11:00:00Z', 'log3'), // same as latest - should be filtered out
        createMockLog('2024-01-01T12:00:00Z', 'log4'), // newer - should be added
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      expect(result.logs).toHaveLength(3);
      expect(result.logs).toEqual([
        ...prev.logs,
        createMockLog('2024-01-01T12:00:00Z', 'log4'),
      ]);
    });
  });

  describe('edge cases with timestamps', () => {
    it('should handle single existing log correctly', () => {
      const prev: GetProjectLogsQuery = {
        logs: [createMockLog('2024-01-01T10:00:00Z', 'log1')],
      };

      const newLogs = [
        createMockLog('2024-01-01T09:00:00Z', 'log2'), // older
        createMockLog('2024-01-01T11:00:00Z', 'log3'), // newer
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      expect(result.logs).toHaveLength(2);
      expect(result.logs).toEqual([
        createMockLog('2024-01-01T10:00:00Z', 'log1'),
        createMockLog('2024-01-01T11:00:00Z', 'log3'),
      ]);
    });

    it('should handle logs with millisecond precision', () => {
      const prev: GetProjectLogsQuery = {
        logs: [
          createMockLog('2024-01-01T10:00:00.500Z', 'log1'),
          createMockLog('2024-01-01T10:00:01.000Z', 'log2'),
        ],
      };

      const newLogs = [
        createMockLog('2024-01-01T10:00:00.999Z', 'log3'), // older by 1ms
        createMockLog('2024-01-01T10:00:01.001Z', 'log4'), // newer by 1ms
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      expect(result.logs).toHaveLength(3);
      expect(result.logs).toEqual([
        ...prev.logs,
        createMockLog('2024-01-01T10:00:01.001Z', 'log4'),
      ]);
    });

    it('should handle timezone differences correctly', () => {
      const prev: GetProjectLogsQuery = {
        logs: [createMockLog('2024-01-01T10:00:00Z', 'log1')], // UTC
      };

      const newLogs = [
        createMockLog('2024-01-01T11:00:00+01:00', 'log2'), // Same time in different timezone (should be filtered)
        createMockLog('2024-01-01T12:00:00+01:00', 'log3'), // 1 hour later UTC (should be added)
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      expect(result.logs).toHaveLength(2);
      expect(result.logs).toEqual([
        createMockLog('2024-01-01T10:00:00Z', 'log1'),
        createMockLog('2024-01-01T12:00:00+01:00', 'log3'),
      ]);
    });
  });

  describe('data structure variations', () => {
    it('should handle empty new logs array', () => {
      const prev: GetProjectLogsQuery = {
        logs: [createMockLog('2024-01-01T10:00:00Z', 'log1')],
      };

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: [] } },
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs).toEqual(prev.logs);
    });

    it('should handle multiple existing logs with out-of-order timestamps', () => {
      const prev: GetProjectLogsQuery = {
        logs: [
          createMockLog('2024-01-01T11:00:00Z', 'log1'),
          createMockLog('2024-01-01T09:00:00Z', 'log2'), // older timestamp
          createMockLog('2024-01-01T10:00:00Z', 'log3'), // middle timestamp
        ],
      };

      const newLogs = [
        createMockLog('2024-01-01T10:30:00Z', 'log4'), // should be filtered (older than max)
        createMockLog('2024-01-01T12:00:00Z', 'log5'), // should be added (newer than max)
      ];

      const result = updateQuery(prev, {
        subscriptionData: { data: { logs: newLogs } },
      });

      // Should use the latest timestamp (11:00:00Z) as the baseline
      expect(result.logs).toHaveLength(4);
      expect(result.logs).toEqual([
        ...prev.logs,
        createMockLog('2024-01-01T12:00:00Z', 'log5'),
      ]);
    });
  });
});
