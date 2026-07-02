import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { AgentsBrowserSidebar } from '@/features/orgs/projects/ai/agents/components/AgentsBrowserSidebar';
import type { GetAgentsQuery } from '@/utils/__generated__/graphite.graphql';

export type Agent = Omit<
  GetAgentsQuery['graphiteAgents'][number],
  '__typename'
>;

export default function AgentsPage() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className="text-muted-foreground">
        Select an agent from the sidebar or create a new one.
      </p>
    </div>
  );
}

AgentsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout mainContainerProps={{ className: 'flex h-full' }}>
      <AgentsBrowserSidebar />
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        <RetryableErrorBoundary>{page}</RetryableErrorBoundary>
      </div>
    </OrgLayout>
  );
};
