import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { AgentsBrowserSidebar } from '@/features/orgs/projects/ai/agents/components/AgentsBrowserSidebar';
import { AgentView } from '@/features/orgs/projects/ai/agents/components/AgentView';

export default function AgentDetailsPage() {
  const router = useRouter();
  const { agentId } = router.query;

  return (
    <RetryableErrorBoundary>
      <AgentView key={agentId as string} />
    </RetryableErrorBoundary>
  );
}

AgentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout mainContainerProps={{ className: 'flex h-full' }}>
      <AgentsBrowserSidebar />
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        {page}
      </div>
    </OrgLayout>
  );
};
