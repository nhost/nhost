import { Plus } from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import { AgentForm } from '@/features/orgs/projects/ai/AgentForm';
import AgentListItem from '@/features/orgs/projects/ai/agents/components/AgentsBrowserSidebar/AgentListItem';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { useGetAgentsQuery } from '@/utils/__generated__/graphite.graphql';

export default function AgentsBrowserSidebar() {
  const { isGraphiteEnabled } = useIsGraphiteEnabled();

  if (!isGraphiteEnabled) {
    return null;
  }

  return (
    <FeatureSidebar>
      <AgentsBrowserSidebarContent />
    </FeatureSidebar>
  );
}

function AgentsBrowserSidebarContent() {
  const { openDrawer } = useDialog();
  const { adminClient } = useAdminApolloClient();

  const { data, loading, error } = useGetAgentsQuery({
    client: adminClient,
  });

  const agents = data?.graphiteAgents ?? [];

  const handleCreate = () => {
    openDrawer({
      title: 'Create a new Agent',
      component: <AgentForm />,
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ActivityIndicator
          label="Loading agents..."
          className="justify-center"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive text-sm">Failed to load agents.</div>
    );
  }

  return (
    <div className="flex h-full flex-col px-2">
      <Button
        variant="link"
        className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline"
        onClick={handleCreate}
      >
        New Agent <Plus className="h-4 w-4" />
      </Button>

      <div className="mt-2 flex flex-col gap-1">
        {agents.map((agent) => (
          <AgentListItem key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
