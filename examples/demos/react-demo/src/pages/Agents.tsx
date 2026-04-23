import type { JSX } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

type AgentProvider = 'anthropic' | 'openai' | 'google';

interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  provider: AgentProvider;
  model: string;
  toolsConfig: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface GetAgents {
  graphiteAgents: Agent[];
}

interface InsertAgent {
  insertGraphiteAgent: Agent;
}

interface UpdateAgent {
  updateGraphiteAgent: Agent;
}

interface DeleteAgent {
  deleteGraphiteAgent: Agent;
}

const PROVIDER_OPTIONS: { value: AgentProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
];

const AGENT_FIELDS = `
  id
  name
  description
  instructions
  provider
  model
  toolsConfig
  createdAt
  updatedAt
`;

type WebSearchProvider = 'brave' | 'tavily';

const WEB_SEARCH_PROVIDERS: { value: WebSearchProvider; label: string }[] = [
  { value: 'brave', label: 'Brave Search' },
  { value: 'tavily', label: 'Tavily' },
];

interface McpServer {
  key: number;
  url: string;
  headers: Record<string, string>;
  requireApproval: boolean;
}

let mcpKeyCounter = 0;

interface AgentFormData {
  name: string;
  description: string;
  instructions: string;
  provider: AgentProvider;
  model: string;
  webFetchEnabled: boolean;
  webFetchRequireApproval: boolean;
  graphqlEnabled: boolean;
  graphqlRequireApproval: boolean;
  webSearchEnabled: boolean;
  webSearchRequireApproval: boolean;
  webSearchProvider: WebSearchProvider;
  webSearchApiKey: string;
  mcpServers: McpServer[];
}

const emptyForm: AgentFormData = {
  name: '',
  description: '',
  instructions: '',
  provider: 'anthropic',
  model: '',
  webFetchEnabled: false,
  webFetchRequireApproval: false,
  graphqlEnabled: false,
  graphqlRequireApproval: false,
  webSearchEnabled: false,
  webSearchRequireApproval: false,
  webSearchProvider: 'brave',
  webSearchApiKey: '',
  mcpServers: [],
};

export default function Agents(): JSX.Element {
  const { nhost, session } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentFormData>(emptyForm);

  const nameId = useId();
  const descId = useId();
  const instructionsId = useId();
  const providerId = useId();
  const modelId = useId();
  const webSearchProviderId = useId();
  const webSearchApiKeyId = useId();

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await nhost.graphql.request<GetAgents>({
        query: `
          query GetAgents {
            graphiteAgents {
              ${AGENT_FIELDS}
            }
          }
        `,
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to fetch agents',
        );
      }

      setAgents(response.body?.data?.graphiteAgents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  const openCreateForm = () => {
    setEditingAgent(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (agent: Agent) => {
    setEditingAgent(agent);
    const tc = agent.toolsConfig as Record<string, unknown> | null;
    const webFetch = tc?.['web_fetch'] as
      | { require_approval?: boolean }
      | boolean
      | undefined;
    const graphql = tc?.['graphql'] as
      | { require_approval?: boolean }
      | boolean
      | undefined;
    const webSearch = tc?.['web_search'] as
      | { provider?: string; api_key?: string; require_approval?: boolean }
      | boolean
      | undefined;
    const mcpServers =
      (tc?.['mcp_servers'] as
        | {
            url?: string;
            headers?: Record<string, string>;
            require_approval?: boolean;
          }[]
        | undefined) || [];
    setForm({
      name: agent.name,
      description: agent.description,
      instructions: agent.instructions,
      provider: agent.provider,
      model: agent.model,
      webFetchEnabled: !!webFetch,
      webFetchRequireApproval:
        typeof webFetch === 'object' ? !!webFetch?.require_approval : false,
      graphqlEnabled: !!graphql,
      graphqlRequireApproval:
        typeof graphql === 'object' ? !!graphql?.require_approval : false,
      webSearchEnabled: !!webSearch,
      webSearchRequireApproval:
        typeof webSearch === 'object' ? !!webSearch?.require_approval : false,
      webSearchProvider:
        typeof webSearch === 'object' && webSearch?.provider === 'tavily'
          ? 'tavily'
          : 'brave',
      webSearchApiKey:
        typeof webSearch === 'object' ? webSearch?.api_key || '' : '',
      mcpServers: mcpServers.map((s) => ({
        key: mcpKeyCounter++,
        url: s.url || '',
        headers: s.headers || {},
        requireApproval: !!s.require_approval,
      })),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingAgent(null);
    setForm(emptyForm);
  };

  const buildObject = (): Record<string, unknown> => {
    const object: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      provider: form.provider,
      model: form.model.trim(),
    };

    const toolsConfig: Record<string, unknown> = {};
    if (form.webFetchEnabled) {
      toolsConfig['web_fetch'] = {
        ...(form.webFetchRequireApproval && { require_approval: true }),
      };
    }
    if (form.graphqlEnabled) {
      toolsConfig['graphql'] = {
        ...(form.graphqlRequireApproval && { require_approval: true }),
      };
    }
    if (form.webSearchEnabled) {
      toolsConfig['web_search'] = {
        provider: form.webSearchProvider,
        ...(form.webSearchApiKey.trim() && {
          api_key: form.webSearchApiKey.trim(),
        }),
        ...(form.webSearchRequireApproval && { require_approval: true }),
      };
    }
    const validMcpServers = form.mcpServers.filter((s) => s.url.trim());
    if (validMcpServers.length > 0) {
      toolsConfig['mcp_servers'] = validMcpServers.map((s) => {
        const server: Record<string, unknown> = { url: s.url.trim() };
        const filteredHeaders = Object.fromEntries(
          Object.entries(s.headers).filter(([k, v]) => k.trim() && v.trim()),
        );
        if (Object.keys(filteredHeaders).length > 0) {
          server['headers'] = filteredHeaders;
        }
        if (s.requireApproval) {
          server['require_approval'] = true;
        }
        return server;
      });
    }
    if (Object.keys(toolsConfig).length > 0) {
      object['toolsConfig'] = toolsConfig;
    }

    return object;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.model.trim()) return;

    try {
      const object = buildObject();

      if (editingAgent) {
        const response = await nhost.graphql.request<UpdateAgent>({
          query: `
            mutation UpdateAgent($id: uuid!, $set: graphiteAgents_set_input!) {
              updateGraphiteAgent(pk_columns: { id: $id }, _set: $set) {
                ${AGENT_FIELDS}
              }
            }
          `,
          variables: { id: editingAgent.id, set: object },
        });

        if (response.body.errors) {
          throw new Error(
            response.body.errors[0]?.message || 'Failed to update agent',
          );
        }

        const updated = response.body?.data?.updateGraphiteAgent;
        if (updated) {
          setAgents(agents.map((a) => (a.id === updated.id ? updated : a)));
        }
      } else {
        const response = await nhost.graphql.request<InsertAgent>({
          query: `
            mutation InsertAgent($object: graphiteAgents_insert_input!) {
              insertGraphiteAgent(object: $object) {
                ${AGENT_FIELDS}
              }
            }
          `,
          variables: { object },
        });

        if (response.body.errors) {
          throw new Error(
            response.body.errors[0]?.message || 'Failed to create agent',
          );
        }

        const created = response.body?.data?.insertGraphiteAgent;
        if (created) {
          setAgents([created, ...agents]);
        }
      }

      closeForm();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      const response = await nhost.graphql.request<DeleteAgent>({
        query: `
          mutation DeleteAgent($id: uuid!) {
            deleteGraphiteAgent(id: $id) {
              id
            }
          }
        `,
        variables: { id },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to delete agent',
        );
      }

      setAgents(agents.filter((a) => a.id !== id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  };

  useEffect(() => {
    if (session) {
      fetchAgents();
    }
  }, [session, fetchAgents]);

  if (!session) {
    return (
      <div className="text-center">
        <p>Please sign in to manage agents.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold gradient-text">Agents</h1>
        {!showForm && (
          <button
            type="button"
            onClick={openCreateForm}
            className="add-todo-text-btn"
            title="Create a new agent"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {showForm && (
        <div className="glass-card mb-8">
          <form onSubmit={handleSubmit} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingAgent ? 'Edit Agent' : 'Create Agent'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="action-icon action-icon-delete"
                title="Cancel"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor={nameId}>Name *</label>
                <input
                  id={nameId}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Agent"
                  required
                />
              </div>
              <div>
                <label htmlFor={descId}>Description</label>
                <input
                  id={descId}
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="A helpful assistant"
                />
              </div>
              <div>
                <label htmlFor={instructionsId}>Instructions</label>
                <textarea
                  id={instructionsId}
                  value={form.instructions}
                  onChange={(e) =>
                    setForm({ ...form, instructions: e.target.value })
                  }
                  placeholder="You are a helpful assistant..."
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label htmlFor={providerId}>Provider *</label>
                  <select
                    id={providerId}
                    value={form.provider}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        provider: e.target.value as AgentProvider,
                      })
                    }
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor={modelId}>Model *</label>
                  <input
                    id={modelId}
                    type="text"
                    value={form.model}
                    onChange={(e) =>
                      setForm({ ...form, model: e.target.value })
                    }
                    placeholder="claude-sonnet-4-20250514"
                    required
                  />
                </div>
              </div>
              <fieldset>
                <legend className="text-sm font-medium mb-2">Tools</legend>
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.webFetchEnabled}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            webFetchEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span>Web Fetch</span>
                    </label>
                    {form.webFetchEnabled && (
                      <label className="flex items-center space-x-1 cursor-pointer text-xs text-secondary">
                        <input
                          type="checkbox"
                          checked={form.webFetchRequireApproval}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              webFetchRequireApproval: e.target.checked,
                            })
                          }
                          className="w-3 h-3"
                        />
                        <span>Require Approval</span>
                      </label>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.graphqlEnabled}
                        onChange={(e) =>
                          setForm({ ...form, graphqlEnabled: e.target.checked })
                        }
                        className="w-4 h-4"
                      />
                      <span>GraphQL</span>
                    </label>
                    {form.graphqlEnabled && (
                      <label className="flex items-center space-x-1 cursor-pointer text-xs text-secondary">
                        <input
                          type="checkbox"
                          checked={form.graphqlRequireApproval}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              graphqlRequireApproval: e.target.checked,
                            })
                          }
                          className="w-3 h-3"
                        />
                        <span>Require Approval</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.webSearchEnabled}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              webSearchEnabled: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span>Web Search</span>
                      </label>
                      {form.webSearchEnabled && (
                        <label className="flex items-center space-x-1 cursor-pointer text-xs text-secondary">
                          <input
                            type="checkbox"
                            checked={form.webSearchRequireApproval}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                webSearchRequireApproval: e.target.checked,
                              })
                            }
                            className="w-3 h-3"
                          />
                          <span>Require Approval</span>
                        </label>
                      )}
                    </div>
                    {form.webSearchEnabled && (
                      <div className="ml-6 mt-2 space-y-2">
                        <div>
                          <label htmlFor={webSearchProviderId}>Provider</label>
                          <select
                            id={webSearchProviderId}
                            value={form.webSearchProvider}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                webSearchProvider: e.target
                                  .value as WebSearchProvider,
                              })
                            }
                          >
                            {WEB_SEARCH_PROVIDERS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={webSearchApiKeyId}>API Key</label>
                          <input
                            id={webSearchApiKeyId}
                            type="password"
                            value={form.webSearchApiKey}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                webSearchApiKey: e.target.value,
                              })
                            }
                            placeholder="Enter API key"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium mb-2">
                  MCP Servers
                </legend>
                <div className="space-y-3">
                  {form.mcpServers.map((server, idx) => (
                    <div
                      key={server.key}
                      className="rounded p-3 space-y-2"
                      style={{
                        border: '1px solid var(--border-color)',
                        background: 'rgba(31, 41, 55, 0.3)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Server {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              mcpServers: form.mcpServers.filter(
                                (_, i) => i !== idx,
                              ),
                            })
                          }
                          className="action-icon action-icon-delete"
                          title="Remove server"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                      <div>
                        <label htmlFor={`mcp-url-${idx}`}>URL *</label>
                        <input
                          id={`mcp-url-${idx}`}
                          type="url"
                          value={server.url}
                          onChange={(e) => {
                            const updated = [...form.mcpServers];
                            updated[idx] = { ...server, url: e.target.value };
                            setForm({ ...form, mcpServers: updated });
                          }}
                          placeholder="https://mcp.example.com/sse"
                          required
                        />
                      </div>
                      <label className="flex items-center space-x-1 cursor-pointer text-xs text-secondary">
                        <input
                          type="checkbox"
                          checked={server.requireApproval}
                          onChange={(e) => {
                            const updated = [...form.mcpServers];
                            updated[idx] = {
                              ...server,
                              requireApproval: e.target.checked,
                            };
                            setForm({ ...form, mcpServers: updated });
                          }}
                          className="w-3 h-3"
                        />
                        <span>Require Approval</span>
                      </label>
                      <div>
                        <span className="text-xs">Headers</span>
                        <div className="space-y-1">
                          {Object.entries(server.headers).map(
                            ([key, value], hIdx) => (
                              <div
                                key={`${server.key}-h-${hIdx}`}
                                className="flex items-center space-x-1"
                              >
                                <input
                                  type="text"
                                  value={key}
                                  onChange={(e) => {
                                    const entries = Object.entries(
                                      server.headers,
                                    );
                                    entries[hIdx] = [e.target.value, value];
                                    const updated = [...form.mcpServers];
                                    updated[idx] = {
                                      ...server,
                                      headers: Object.fromEntries(entries),
                                    };
                                    setForm({ ...form, mcpServers: updated });
                                  }}
                                  placeholder="Header name"
                                  className="flex-1"
                                />
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => {
                                    const entries = Object.entries(
                                      server.headers,
                                    );
                                    entries[hIdx] = [key, e.target.value];
                                    const updated = [...form.mcpServers];
                                    updated[idx] = {
                                      ...server,
                                      headers: Object.fromEntries(entries),
                                    };
                                    setForm({ ...form, mcpServers: updated });
                                  }}
                                  placeholder="Header value"
                                  className="flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const entries = Object.entries(
                                      server.headers,
                                    ).filter((_, i) => i !== hIdx);
                                    const updated = [...form.mcpServers];
                                    updated[idx] = {
                                      ...server,
                                      headers: Object.fromEntries(entries),
                                    };
                                    setForm({ ...form, mcpServers: updated });
                                  }}
                                  className="action-icon action-icon-delete"
                                  title="Remove header"
                                >
                                  <svg
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            ),
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...form.mcpServers];
                              updated[idx] = {
                                ...server,
                                headers: { ...server.headers, '': '' },
                              };
                              setForm({ ...form, mcpServers: updated });
                            }}
                            className="btn"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.625rem',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: 'var(--primary)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                            }}
                          >
                            + Add Header
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        mcpServers: [
                          ...form.mcpServers,
                          {
                            key: mcpKeyCounter++,
                            url: '',
                            headers: {},
                            requireApproval: false,
                          },
                        ],
                      })
                    }
                    className="btn"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.375rem 0.75rem',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--primary)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    + Add MCP Server
                  </button>
                </div>
              </fieldset>
              <div className="flex space-x-2">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingAgent ? 'Save Changes' : 'Create Agent'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn btn-secondary"
                  style={{
                    backgroundColor: 'var(--text-muted)',
                    color: 'white',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {!showForm &&
        (loading ? (
          <div className="loading-container">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-secondary">Loading agents...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5"
                  />
                </svg>
                <h3 className="text-lg font-medium mb-2">No agents yet</h3>
                <p className="text-muted">
                  Create your first agent to get started!
                </p>
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="glass-card p-6 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-xl font-medium text-primary">
                          {agent.name}
                        </h3>
                        <span className="scope-tag">{agent.provider}</span>
                        <span className="scope-tag">{agent.model}</span>
                      </div>
                      {agent.description && (
                        <p className="text-secondary text-sm mb-2">
                          {agent.description}
                        </p>
                      )}
                      {agent.instructions && (
                        <p className="text-muted text-xs">
                          {agent.instructions.length > 120
                            ? `${agent.instructions.slice(0, 120)}...`
                            : agent.instructions}
                        </p>
                      )}
                    </div>
                    <div className="table-actions">
                      <Link
                        to={`/agents/${agent.id}/chat`}
                        className="action-icon action-icon-view"
                        title="Chat with agent"
                      >
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditForm(agent)}
                        className="action-icon action-icon-view"
                        title="Edit agent"
                      >
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAgent(agent.id)}
                        className="action-icon action-icon-delete"
                        title="Delete agent"
                      >
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
    </div>
  );
}
