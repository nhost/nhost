import type { Agent } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/agents';
import { GraphiteAgentProviders_Enum } from '@/utils/__generated__/graphite.graphql';

const providerLabels: Record<GraphiteAgentProviders_Enum, string> = {
  [GraphiteAgentProviders_Enum.Anthropic]: 'Anthropic',
  [GraphiteAgentProviders_Enum.Google]: 'Google',
  [GraphiteAgentProviders_Enum.Openai]: 'OpenAI',
};

interface ToolsConfig {
  web_search?: { provider: string; require_approval?: boolean };
  web_fetch?: { require_approval?: boolean };
  graphql?: {
    require_approval_queries?: boolean;
    require_approval_mutations?: boolean;
  };
  mcp_servers?: Array<{
    url: string;
    headers?: Record<string, string>;
    require_approval?: boolean;
    tool_overrides?: Record<string, { require_approval?: boolean }>;
  }>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function ToolBadge({ name, approval }: { name: string; approval?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
      <span className="font-medium">{name}</span>
      {approval && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 text-xs dark:bg-amber-900 dark:text-amber-200">
          Approval required
        </span>
      )}
    </div>
  );
}

function ToolsSection({ toolsConfig }: { toolsConfig: ToolsConfig }) {
  const hasTools =
    toolsConfig.web_search ||
    toolsConfig.web_fetch ||
    toolsConfig.graphql ||
    (toolsConfig.mcp_servers && toolsConfig.mcp_servers.length > 0);

  if (!hasTools) {
    return null;
  }

  return (
    <div className="rounded border p-4">
      <h3 className="mb-3 font-medium">Tools</h3>
      <div className="flex flex-wrap gap-2">
        {toolsConfig.web_search && (
          <ToolBadge
            name={`Web Search (${toolsConfig.web_search.provider})`}
            approval={toolsConfig.web_search.require_approval}
          />
        )}
        {toolsConfig.web_fetch && (
          <ToolBadge
            name="Web Fetch"
            approval={toolsConfig.web_fetch.require_approval}
          />
        )}
        {toolsConfig.graphql && (
          <>
            <ToolBadge
              name="GraphQL Queries"
              approval={toolsConfig.graphql.require_approval_queries}
            />
            <ToolBadge
              name="GraphQL Mutations"
              approval={toolsConfig.graphql.require_approval_mutations}
            />
          </>
        )}
      </div>

      {toolsConfig.mcp_servers && toolsConfig.mcp_servers.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-sm">MCP Servers</h4>
          {toolsConfig.mcp_servers.map((server) => (
            <div key={server.url} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{server.url}</span>
                {server.require_approval && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 text-xs dark:bg-amber-900 dark:text-amber-200">
                    Approval required
                  </span>
                )}
              </div>
              {server.tool_overrides &&
                Object.keys(server.tool_overrides).length > 0 && (
                  <div className="mt-2 text-muted-foreground text-xs">
                    Overrides:{' '}
                    {Object.entries(server.tool_overrides)
                      .map(
                        ([tool, config]) =>
                          `${tool}: ${config.require_approval ? 'approval' : 'no approval'}`,
                      )
                      .join(', ')}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentOverview({ agent }: { agent: Agent }) {
  const toolsConfig = (agent.toolsConfig as ToolsConfig) ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded border p-4">
          <h3 className="mb-3 font-medium">Configuration</h3>
          <div className="space-y-2 text-sm">
            <InfoRow label="Provider" value={providerLabels[agent.provider]} />
            <InfoRow label="Model" value={agent.model} />
            <InfoRow label="ID" value={agent.id} />
          </div>
        </div>

        <div className="rounded border p-4">
          <h3 className="mb-3 font-medium">Description</h3>
          <p className="text-muted-foreground text-sm">
            {agent.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {agent.instructions && (
        <div className="rounded border p-4">
          <h3 className="mb-3 font-medium">Instructions</h3>
          <pre className="whitespace-pre-wrap text-muted-foreground text-sm">
            {agent.instructions}
          </pre>
        </div>
      )}

      <ToolsSection toolsConfig={toolsConfig} />
    </div>
  );
}
