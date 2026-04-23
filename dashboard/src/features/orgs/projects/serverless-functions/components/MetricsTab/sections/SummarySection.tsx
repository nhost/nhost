import { Activity, Clock, HardDrive } from 'lucide-react';
import StatCard from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/StatCard';
import {
  formatBytes,
  formatDurationSeconds,
  formatInteger,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import type { FunctionMetricsSummary } from '@/features/orgs/projects/serverless-functions/types';

export interface SummarySectionProps {
  summary: FunctionMetricsSummary;
}

export default function SummarySection({ summary }: SummarySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard
        icon={Activity}
        label="Total Number of Invocations"
        value={formatInteger(summary.totalInvocations)}
      />
      <StatCard
        icon={HardDrive}
        label="Total Bytes Sent"
        value={formatBytes(summary.totalBytesSent)}
      />
      <StatCard
        icon={Clock}
        label="Total Duration"
        value={formatDurationSeconds(summary.totalDurationSeconds)}
      />
    </div>
  );
}
