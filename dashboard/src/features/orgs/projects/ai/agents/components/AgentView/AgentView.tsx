import { useRouter } from 'next/router';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { Spinner } from '@/components/ui/v3/spinner';
import { AgentChat } from '@/features/orgs/projects/ai/agents/components/AgentChat';
import AgentOverview from '@/features/orgs/projects/ai/agents/components/AgentView/sections/AgentOverview';
import AgentSessions from '@/features/orgs/projects/ai/agents/components/AgentView/sections/AgentSessions';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useGetAgentsQuery } from '@/utils/__generated__/graphite.graphql';

const VALID_TABS = ['overview', 'sessions', 'chat'] as const;
type AgentTab = (typeof VALID_TABS)[number];

function isAgentTab(value: unknown): value is AgentTab {
  return (
    typeof value === 'string' &&
    (VALID_TABS as readonly string[]).includes(value)
  );
}

export default function AgentView() {
  const router = useRouter();
  const { agentId, tab: tabParam } = router.query;
  const adminClient = useRemoteApplicationGQLClient();

  const tab: AgentTab = isAgentTab(tabParam) ? tabParam : 'overview';

  const { data, loading, error } = useGetAgentsQuery({
    client: adminClient,
  });

  const agent = data?.graphiteAgents?.find((a) => a.id === agentId);

  const handleTabChange = (newTab: string) => {
    if (!isAgentTab(newTab) || newTab === tab) {
      return;
    }
    router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: newTab } },
      undefined,
      { shallow: true },
    );
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="xs" wrapperClassName="flex-row gap-1.5">
          <span className="text-muted-foreground text-xs">
            Loading agent...
          </span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Failed to load agent.</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex h-full flex-col"
      >
        <div className="sticky top-0 z-10 border-b bg-background">
          <div className="p-6">
            <h1 className="mb-1 font-semibold text-xl">{agent.name}</h1>
            <p className="text-muted-foreground text-sm">Agent Configuration</p>
          </div>

          <div className="px-6 pb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="overflow-auto p-6">
          <AgentOverview agent={agent} />
        </TabsContent>

        <TabsContent value="chat" className="mt-0 flex-1 overflow-hidden">
          <AgentChat agent={agent} />
        </TabsContent>

        <TabsContent value="sessions" className="overflow-auto p-6">
          <AgentSessions agent={agent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
