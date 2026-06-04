import { Activity, Clock, HardDrive } from 'lucide-react';
import StatCard from '@/features/orgs/projects/common/metrics/components/StatCard';
import {
  formatBytesSI,
  formatDurationSeconds,
  formatInteger,
} from '@/features/orgs/projects/common/metrics/utils/formatters';
import type { FunctionMetricsSummary } from '@/features/orgs/projects/serverless-functions/types';

export interface SummarySectionProps {
  summary: FunctionMetricsSummary;
}

export default function SummarySection({ summary }: SummarySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <StatCard
        icon={Activity}
        label="Total Number of Invocations"
        value={formatInteger(summary.totalInvocations)}
      />
      <StatCard
        icon={HardDrive}
        label="Total Bytes Sent"
        value={formatBytesSI(summary.totalBytesSent)}
      />
      <StatCard
        icon={Clock}
        label="Total Duration"
        value={formatDurationSeconds(summary.totalDurationSeconds)}
      />
    </div>
  );
}
