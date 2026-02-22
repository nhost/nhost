import bcrypt from 'bcryptjs';
import type { JSX } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';

interface OAuth2Client {
  id: string;
  clientId: string;
  redirectUris: string[];
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  metadata: { description?: string } | null;
}

interface GetClients {
  authOauth2Clients: OAuth2Client[];
}

interface InsertClient {
  insertAuthOauth2Client: OAuth2Client | null;
}

interface UpdateClients {
  updateAuthOauth2Clients: { returning: OAuth2Client[] } | null;
}

function generateSecret(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

const DEFAULT_SCOPES = new Set(['openid', 'profile', 'email']);

export default function OAuth2Providers(): JSX.Element {
  const { nhost, session } = useAuth();
  const [clients, setClients] = useState<OAuth2Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState<OAuth2Client | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    new Set(),
  );
  const [createdSecret, setCreatedSecret] = useState<{
    clientId: string;
    secret: string;
  } | null>(null);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);

  // Create form state
  const [newRedirectUris, setNewRedirectUris] = useState('');
  const [newSelectedScopes, setNewSelectedScopes] =
    useState<Set<string>>(DEFAULT_SCOPES);
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editRedirectUris, setEditRedirectUris] = useState('');
  const [editSelectedScopes, setEditSelectedScopes] = useState<Set<string>>(
    new Set(),
  );
  const [editDescription, setEditDescription] = useState('');
  const [regenerateSecret, setRegenerateSecret] = useState(false);

  const redirectUrisId = useId();
  const descriptionId = useId();

  const toggleScope = (
    selected: Set<string>,
    setSelected: (s: Set<string>) => void,
    scope: string,
  ) => {
    const next = new Set(selected);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    setSelected(next);
  };

  const clientFields = `
    id
    clientId
    redirectUris
    scopes
    metadata
    createdAt
    updatedAt
  `;

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await nhost.graphql.request<GetClients>({
        query: `
          query GetOAuth2Clients {
            authOauth2Clients(order_by: { createdAt: desc }) {
              ${clientFields}
            }
          }
        `,
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to fetch clients',
        );
      }

      setClients(response.body?.data?.authOauth2Clients || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();

    const redirectUris = newRedirectUris
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    if (redirectUris.length === 0) return;

    const scopes = Array.from(newSelectedScopes);

    setCreating(true);
    try {
      const plainSecret = generateSecret();
      const clientSecretHash = await bcrypt.hash(plainSecret, 10);

      const response = await nhost.graphql.request<InsertClient>({
        query: `
          mutation InsertOAuth2Client($object: authOauth2Clients_insert_input!) {
            insertAuthOauth2Client(object: $object) {
              ${clientFields}
            }
          }
        `,
        variables: {
          object: {
            clientSecretHash,
            redirectUris,
            scopes,
            metadata: newDescription.trim()
              ? { description: newDescription.trim() }
              : null,
          },
        },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to create client',
        );
      }

      const created = response.body?.data?.insertAuthOauth2Client;
      if (!created) {
        throw new Error('Failed to create client');
      }

      setClients([created, ...clients]);
      setCreatedSecret({ clientId: created.clientId, secret: plainSecret });
      setNewRedirectUris('');
      setNewSelectedScopes(new Set(DEFAULT_SCOPES));
      setNewDescription('');
      setShowAddForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setCreating(false);
    }
  };

  const updateClient = async (clientId: string) => {
    const redirectUris = editRedirectUris
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    const scopes = Array.from(editSelectedScopes);

    try {
      let plainSecret: string | null = null;
      const changes: Record<string, unknown> = {
        redirectUris,
        scopes,
        metadata: editDescription.trim()
          ? { description: editDescription.trim() }
          : null,
      };

      if (regenerateSecret) {
        plainSecret = generateSecret();
        changes['clientSecretHash'] = await bcrypt.hash(plainSecret, 10);
      }

      const response = await nhost.graphql.request<UpdateClients>({
        query: `
          mutation UpdateOAuth2Client($clientId: String!, $changes: authOauth2Clients_set_input!) {
            updateAuthOauth2Clients(
              where: { clientId: { _eq: $clientId } }
              _set: $changes
            ) {
              returning {
                ${clientFields}
              }
            }
          }
        `,
        variables: { clientId, changes },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to update client',
        );
      }

      const updated =
        response.body?.data?.updateAuthOauth2Clients?.returning?.[0];
      if (updated) {
        setClients(clients.map((c) => (c.id === updated.id ? updated : c)));
        if (plainSecret) {
          setCreatedSecret({ clientId: updated.clientId, secret: plainSecret });
        }
      }
      setEditingClient(null);
      setRegenerateSecret(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this OAuth2 client?')) return;

    try {
      const response = await nhost.graphql.request({
        query: `
          mutation DeleteOAuth2Client($clientId: String!) {
            deleteAuthOauth2Clients(where: { clientId: { _eq: $clientId } }) {
              affected_rows
            }
          }
        `,
        variables: { clientId },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to delete client',
        );
      }

      setClients(clients.filter((c) => c.clientId !== clientId));
      if (createdSecret?.clientId === clientId) {
        setCreatedSecret(null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client');
    }
  };

  const startEdit = (client: OAuth2Client) => {
    setEditingClient(client);
    setEditRedirectUris(client.redirectUris.join('\n'));
    setEditSelectedScopes(new Set(client.scopes));
    setEditDescription(client.metadata?.description || '');
    setRegenerateSecret(false);
  };

  const toggleExpansion = (id: string) => {
    const next = new Set(expandedClients);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedClients(next);
  };

  const fetchAvailableScopes = useCallback(async () => {
    try {
      const response = await nhost.auth.getOpenIDConfiguration();
      setAvailableScopes(response.body.scopes_supported || []);
    } catch {
      // fall back silently — scopes list just won't render
    }
  }, [nhost.auth]);

  useEffect(() => {
    fetchAvailableScopes();
  }, [fetchAvailableScopes]);

  useEffect(() => {
    if (session) {
      fetchClients();
    }
  }, [session, fetchClients]);

  if (!session) {
    return (
      <div className="text-center">
        <p>Please sign in to manage OAuth2 providers.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold gradient-text">OAuth2 Providers</h1>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="add-todo-text-btn"
            title="Add a new OAuth2 client"
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

      {createdSecret && (
        <div className="alert alert-success mb-6">
          <div className="flex items-center justify-between mb-2">
            <strong>Client Secret for {createdSecret.clientId}</strong>
            <button
              type="button"
              onClick={() => setCreatedSecret(null)}
              className="action-icon action-icon-delete"
              title="Dismiss"
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
          <pre
            style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '0.5rem',
              borderRadius: '0.25rem',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              border: 'none',
              marginBottom: '0.5rem',
            }}
          >
            {createdSecret.secret}
          </pre>
          <p className="text-sm" style={{ opacity: 0.85 }}>
            Copy this secret now. Once you dismiss this message, the secret
            cannot be retrieved. If you lose it, you will need to regenerate a
            new one.
          </p>
        </div>
      )}

      {showAddForm && (
        <div className="glass-card mb-8">
          <form onSubmit={addClient} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">New OAuth2 Client</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewRedirectUris('');
                  setNewSelectedScopes(new Set(DEFAULT_SCOPES));
                  setNewDescription('');
                }}
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
            <p className="text-sm text-muted mb-4">
              A client secret will be automatically generated for you.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor={`${redirectUrisId}-new`}>
                  Redirect URIs * (one per line)
                </label>
                <textarea
                  id={`${redirectUrisId}-new`}
                  value={newRedirectUris}
                  onChange={(e) => setNewRedirectUris(e.target.value)}
                  placeholder="https://example.com/callback"
                  rows={3}
                  required
                />
              </div>
              <div>
                <span className="text-sm font-medium text-secondary">
                  Scopes
                </span>
                <div className="scope-tags" style={{ marginTop: '0.5rem' }}>
                  {availableScopes.map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      className="scope-tag"
                      style={{
                        cursor: 'pointer',
                        opacity: newSelectedScopes.has(scope) ? 1 : 0.4,
                        border: newSelectedScopes.has(scope)
                          ? '1px solid var(--primary)'
                          : '1px solid transparent',
                      }}
                      onClick={() =>
                        toggleScope(
                          newSelectedScopes,
                          setNewSelectedScopes,
                          scope,
                        )
                      }
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor={`${descriptionId}-new`}>Description</label>
                <input
                  id={`${descriptionId}-new`}
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="My OAuth2 application"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={creating}
                >
                  <svg
                    className="w-4 h-4 mr-2 inline-block"
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
                  {creating ? 'Creating...' : 'Create Client'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewRedirectUris('');
                    setNewSelectedScopes(new Set(DEFAULT_SCOPES));
                    setNewDescription('');
                  }}
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

      {!showAddForm &&
        (loading ? (
          <div className="loading-container">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-secondary">Loading clients...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.length === 0 ? (
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
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                <h3 className="text-lg font-medium mb-2">
                  No OAuth2 clients yet
                </h3>
                <p className="text-muted">
                  Create your first OAuth2 client to get started!
                </p>
              </div>
            ) : (
              clients.map((client) => (
                <div
                  key={client.id}
                  className="glass-card transition-all duration-200 hover:shadow-lg"
                >
                  {editingClient?.id === client.id ? (
                    <div className="p-6">
                      <div className="space-y-4">
                        <div>
                          <span
                            className="text-xs text-muted"
                            style={{
                              display: 'block',
                              marginBottom: '0.125rem',
                            }}
                          >
                            Client ID
                          </span>
                          <p
                            style={{
                              fontFamily: 'var(--font-geist-mono)',
                              fontSize: '0.875rem',
                            }}
                          >
                            {client.clientId}
                          </p>
                        </div>
                        <div>
                          <label htmlFor={`${redirectUrisId}-edit`}>
                            Redirect URIs (one per line)
                          </label>
                          <textarea
                            id={`${redirectUrisId}-edit`}
                            value={editRedirectUris}
                            onChange={(e) =>
                              setEditRedirectUris(e.target.value)
                            }
                            rows={3}
                          />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-secondary">
                            Scopes
                          </span>
                          <div
                            className="scope-tags"
                            style={{ marginTop: '0.5rem' }}
                          >
                            {availableScopes.map((scope) => (
                              <button
                                key={scope}
                                type="button"
                                className="scope-tag"
                                style={{
                                  cursor: 'pointer',
                                  opacity: editSelectedScopes.has(scope)
                                    ? 1
                                    : 0.4,
                                  border: editSelectedScopes.has(scope)
                                    ? '1px solid var(--primary)'
                                    : '1px solid transparent',
                                }}
                                onClick={() =>
                                  toggleScope(
                                    editSelectedScopes,
                                    setEditSelectedScopes,
                                    scope,
                                  )
                                }
                              >
                                {scope}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`${descriptionId}-edit`}>
                            Description
                          </label>
                          <input
                            id={`${descriptionId}-edit`}
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                          />
                        </div>
                        <div
                          className="p-3 rounded"
                          style={{
                            background: 'rgba(31, 41, 55, 0.5)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <label
                            className="flex items-center cursor-pointer"
                            style={{ marginBottom: 0 }}
                          >
                            <input
                              type="checkbox"
                              checked={regenerateSecret}
                              onChange={(e) =>
                                setRegenerateSecret(e.target.checked)
                              }
                              style={{ width: 'auto', marginRight: '0.5rem' }}
                            />
                            Regenerate client secret
                          </label>
                          {regenerateSecret && (
                            <p
                              className="text-xs text-muted"
                              style={{ marginTop: '0.25rem' }}
                            >
                              A new secret will be generated. The current secret
                              will stop working immediately.
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => updateClient(client.clientId)}
                            className="btn btn-secondary flex-1"
                          >
                            <svg
                              className="w-4 h-4 mr-2 inline-block"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClient(null);
                              setRegenerateSecret(false);
                            }}
                            className="btn btn-secondary flex-1"
                            style={{
                              backgroundColor: 'var(--text-muted)',
                              color: 'white',
                            }}
                          >
                            <svg
                              className="w-4 h-4 mr-2 inline-block"
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
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <button
                          type="button"
                          className="text-xl font-medium transition-all cursor-pointer hover:text-primary-hover text-left text-primary"
                          onClick={() => toggleExpansion(client.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontFamily: 'var(--font-geist-mono)',
                            fontSize: '0.95rem',
                          }}
                        >
                          {client.clientId}
                        </button>
                        <div className="table-actions">
                          <button
                            type="button"
                            onClick={() => startEdit(client)}
                            className="action-icon action-icon-view"
                            title="Edit client"
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
                            onClick={() => deleteClient(client.clientId)}
                            className="action-icon action-icon-delete"
                            title="Delete client"
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

                      {client.metadata?.description && (
                        <p className="text-secondary text-sm mb-2">
                          {client.metadata.description}
                        </p>
                      )}

                      <div className="scope-tags">
                        {client.scopes.map((scope) => (
                          <span key={scope} className="scope-tag">
                            {scope}
                          </span>
                        ))}
                      </div>

                      {expandedClients.has(client.id) && (
                        <div className="mt-4 space-y-3">
                          <div className="client-info">
                            <div className="mb-3">
                              <span className="text-sm text-muted">
                                Redirect URIs
                              </span>
                              {client.redirectUris.map((uri) => (
                                <p
                                  key={uri}
                                  className="text-sm"
                                  style={{ wordBreak: 'break-all' }}
                                >
                                  {uri}
                                </p>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-3">
                              <span className="text-muted">
                                Created:{' '}
                                {new Date(client.createdAt).toLocaleString()}
                              </span>
                              <span className="text-muted">
                                Updated:{' '}
                                {new Date(client.updatedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ))}
    </div>
  );
}
