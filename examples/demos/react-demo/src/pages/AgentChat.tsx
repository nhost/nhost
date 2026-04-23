import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

interface Agent {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
}

interface AgentSession {
  id: string;
  agentID: string;
  createdAt: string;
}

interface ToolCall {
  name: string;
  [key: string]: unknown;
}

interface AgentMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  toolCalls?: ToolCall[] | null;
  toolName?: string | null;
}

interface ChatMessage {
  key: string;
  role: 'user' | 'assistant' | 'status' | 'other';
  content: string;
  streaming?: boolean;
  originalRole?: string;
  toolCalls?: ToolCall[] | null;
  toolName?: string | null;
}

interface GetAgent {
  graphiteAgent: Agent | null;
}

interface GetSessions {
  graphiteAgentSessions: AgentSession[];
}

interface StartSession {
  insertGraphiteAgentSession: AgentSession;
}

interface DeleteSession {
  deleteGraphiteAgentSession: AgentSession;
}

interface GetMessages {
  graphiteAgentMessages: AgentMessage[];
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
  requires_approval: boolean;
}

export default function AgentChat(): JSX.Element {
  const { agentId } = useParams<{ agentId: string }>();
  const { nhost, session } = useAuth();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCall[]>(
    [],
  );
  const [approving, setApproving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextKeyRef = useRef(0);
  const [atBottom, setAtBottom] = useState(true);

  const genKey = () => {
    nextKeyRef.current += 1;
    return `msg-${nextKeyRef.current}`;
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 50;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  useEffect(() => {
    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, atBottom]);

  const fetchAgent = useCallback(async () => {
    if (!agentId) return;

    try {
      const response = await nhost.graphql.request<GetAgent>({
        query: `
          query GetAgent($id: uuid!) {
            graphiteAgent(id: $id) {
              id
              name
              description
              provider
              model
            }
          }
        `,
        variables: { id: agentId },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to fetch agent',
        );
      }

      setAgent(response.body?.data?.graphiteAgent || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent');
    }
  }, [nhost.graphql, agentId]);

  const fetchSessions = useCallback(async () => {
    if (!agentId) return;

    try {
      const response = await nhost.graphql.request<GetSessions>({
        query: `
          query GetSessions($agentID: uuid!) {
            graphiteAgentSessions(where: { agentID: { _eq: $agentID } }, order_by: { createdAt: desc }) {
              id
              agentID
              createdAt
            }
          }
        `,
        variables: { agentID: agentId },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to fetch sessions',
        );
      }

      setSessions(response.body?.data?.graphiteAgentSessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    }
  }, [nhost.graphql, agentId]);

  const loadSessionMessages = useCallback(
    async (sessionId: string) => {
      try {
        const response = await nhost.graphql.request<GetMessages>({
          query: `
          query GetMessages($sessionID: uuid!) {
            graphiteAgentMessages(
              where: { sessionID: { _eq: $sessionID } }
              order_by: { createdAt: asc }
            ) {
              id
              role
              content
              createdAt
              toolCalls
              toolName
            }
          }
        `,
          variables: { sessionID: sessionId },
        });

        if (response.body.errors) {
          throw new Error(
            response.body.errors[0]?.message || 'Failed to fetch messages',
          );
        }

        const msgs = response.body?.data?.graphiteAgentMessages || [];
        setMessages(
          msgs.map((m) => ({
            key: m.id,
            role: (m.role === 'user' || m.role === 'assistant'
              ? m.role
              : 'other') as ChatMessage['role'],
            content: m.content,
            originalRole: m.role,
            toolCalls:
              typeof m.toolCalls === 'string'
                ? JSON.parse(m.toolCalls)
                : m.toolCalls,
            toolName: m.toolName,
          })),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load messages',
        );
      }
    },
    [nhost.graphql],
  );

  const startNewSession = async () => {
    if (!agentId) return;

    try {
      const response = await nhost.graphql.request<StartSession>({
        query: `
          mutation StartSession($object: graphiteAgentSessions_insert_input!) {
            insertGraphiteAgentSession(object: $object) {
              id
              agentID
              createdAt
            }
          }
        `,
        variables: { object: { agentID: agentId } },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to start session',
        );
      }

      const newSession = response.body?.data?.insertGraphiteAgentSession;
      if (newSession) {
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await nhost.graphql.request<DeleteSession>({
        query: `
          mutation DeleteSession($id: uuid!) {
            deleteGraphiteAgentSession(id: $id) {
              id
            }
          }
        `,
        variables: { id: sessionId },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to delete session',
        );
      }

      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);

      if (activeSessionId === sessionId) {
        const first = remaining[0];
        if (first) {
          setActiveSessionId(first.id);
          await loadSessionMessages(first.id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const selectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    await loadSessionMessages(sessionId);
  };

  const processSSEStream = async (response: Response, signal?: AbortSignal) => {
    if (!response.body) {
      throw new Error('No response body');
    }

    // Local array of all messages produced during this stream.
    // We sync this to React state after each event, avoiding closure/batching bugs.
    const streamMessages: ChatMessage[] = [];
    let assistantContent = '';
    let currentAssistantIdx = -1;
    // Stable key used to find where stream messages start in the React state array.
    let anchorKey: string | null = null;

    const addAssistantMessage = () => {
      assistantContent = '';
      const key = genKey();
      if (!anchorKey) anchorKey = key;
      currentAssistantIdx = streamMessages.length;
      streamMessages.push({
        key,
        role: 'assistant',
        content: '',
        streaming: true,
      });
    };

    addAssistantMessage();

    const syncToState = () => {
      setMessages((prev) => {
        const snapshot = streamMessages.map((m) => ({ ...m }));
        const idx = anchorKey
          ? prev.findIndex((m) => m.key === anchorKey)
          : -1;
        if (idx === -1) return [...prev, ...snapshot];
        return [...prev.slice(0, idx), ...snapshot];
      });
    };

    syncToState();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';
    let dataLines: string[] = [];
    let collectingData = false;

    const dispatchEvent = () => {
      if (!currentEvent || !collectingData) {
        currentEvent = '';
        dataLines = [];
        collectingData = false;
        return;
      }
      while (dataLines.length > 0 && dataLines[dataLines.length - 1] === '') {
        dataLines.pop();
      }
      const data = dataLines.join('\n');
      const eventType = currentEvent;
      currentEvent = '';
      dataLines = [];
      collectingData = false;

      if (eventType === 'content_delta') {
        assistantContent += data;
        if (currentAssistantIdx >= 0 && currentAssistantIdx < streamMessages.length) {
          streamMessages[currentAssistantIdx] = {
            ...streamMessages[currentAssistantIdx],
            content: assistantContent,
          };
        }
        syncToState();
      } else if (eventType === 'tool_use_start') {
        streamMessages.push({
          key: genKey(),
          role: 'other',
          content: data,
          originalRole: 'tool_call',
        });
        streamMessages.push({
          key: genKey(),
          role: 'status',
          content: `Running ${data}...`,
        });
        syncToState();
      } else if (eventType === 'tool_use_done') {
        const statusContent = `Running ${data}...`;
        const statusIdx = streamMessages.findIndex(
          (m) => m.role === 'status' && m.content === statusContent,
        );
        if (statusIdx !== -1) {
          streamMessages.splice(statusIdx, 1);
          if (currentAssistantIdx > statusIdx) {
            currentAssistantIdx--;
          }
        }
        syncToState();
      } else if (eventType === 'tool_result') {
        streamMessages.push({
          key: genKey(),
          role: 'other',
          content: data,
          originalRole: 'tool_result',
        });
        addAssistantMessage();
        syncToState();
      } else if (eventType === 'tool_approval_required') {
        try {
          const parsed = JSON.parse(data);
          const toolCalls = parsed.tool_calls as PendingToolCall[] | undefined;
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            // Remove empty streaming assistant messages while awaiting approval
            for (let i = streamMessages.length - 1; i >= 0; i--) {
              if (streamMessages[i].streaming && !streamMessages[i].content) {
                streamMessages.splice(i, 1);
                if (currentAssistantIdx >= i) currentAssistantIdx--;
              }
            }
            syncToState();
            setPendingToolCalls(toolCalls);
            setStreaming(false);
          }
        } catch {
          // ignore malformed JSON
        }
      } else if (eventType === 'tool_denied') {
        streamMessages.push({
          key: genKey(),
          role: 'other',
          content: data,
          originalRole: 'tool_denied',
        });
        syncToState();
      } else if (eventType === 'error') {
        setError(data);
      }
    };

    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('event: ')) {
          dispatchEvent();
          currentEvent = line.slice(7).trim();
          collectingData = false;
        } else if (
          currentEvent &&
          !collectingData &&
          line.startsWith('data:')
        ) {
          collectingData = true;
          dataLines.push(
            line.startsWith('data: ') ? line.slice(6) : line.slice(5),
          );
        } else if (collectingData) {
          dataLines.push(line);
        }
      }
    }
    dispatchEvent();
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSessionId || streaming) return;

    const userMessage = input.trim();
    setInput('');
    const userKey = genKey();
    setMessages((prev) => [
      ...prev,
      { key: userKey, role: 'user', content: userMessage },
    ]);
    setStreaming(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const accessToken = nhost.getUserSession()?.accessToken;

      const graphiteBaseUrl =
        import.meta.env['VITE_GRAPHITE_BASE_URL'] || 'http://localhost:8090';
      const url = `${graphiteBaseUrl}/v1/agents/sessions/${activeSessionId}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ message: userMessage }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || `HTTP ${response.status}`);
      }

      await processSSEStream(response, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Reload full messages from DB to get complete tool call/result details
      // that the SSE stream doesn't include.
      if (activeSessionId) {
        await loadSessionMessages(activeSessionId);
      }
      inputRef.current?.focus();
    }
  };

  const handleToolApproval = async (
    decisions: { tool_call_id: string; approved: boolean }[],
  ) => {
    if (!activeSessionId) return;

    setApproving(true);
    setPendingToolCalls([]);
    setStreaming(true);
    setError(null);

    try {
      const accessToken = nhost.getUserSession()?.accessToken;
      const graphiteBaseUrl =
        import.meta.env['VITE_GRAPHITE_BASE_URL'] || 'http://localhost:8090';
      const url = `${graphiteBaseUrl}/v1/agents/sessions/${activeSessionId}/approve-tools`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ decisions }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || `HTTP ${response.status}`);
      }

      await processSSEStream(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to process tool approval',
      );
    } finally {
      setApproving(false);
      setStreaming(false);
      if (activeSessionId) {
        await loadSessionMessages(activeSessionId);
      }
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (session && agentId) {
      setLoading(true);
      Promise.all([fetchAgent(), fetchSessions()]).finally(() =>
        setLoading(false),
      );
    }
  }, [session, agentId, fetchAgent, fetchSessions]);

  useEffect(() => {
    const first = sessions[0];
    if (first && !activeSessionId) {
      setActiveSessionId(first.id);
      loadSessionMessages(first.id);
    }
  }, [sessions, activeSessionId, loadSessionMessages]);

  if (!session) {
    return (
      <div className="text-center">
        <p>Please sign in to chat with agents.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center">
        <p>Agent not found.</p>
        <Link to="/agents" className="text-primary">
          Back to agents
        </Link>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <Link to="/agents" className="text-sm text-secondary">
            &larr; Agents
          </Link>
          <h2 className="text-lg font-semibold" style={{ marginTop: '0.5rem' }}>
            {agent.name}
          </h2>
          <div className="flex space-x-1" style={{ marginTop: '0.25rem' }}>
            <span className="scope-tag">{agent.provider}</span>
            <span className="scope-tag">{agent.model}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={startNewSession}
          className="btn btn-primary"
          style={{ margin: '0.75rem', width: 'calc(100% - 1.5rem)' }}
        >
          New Session
        </button>

        <div className="chat-sessions-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`chat-session-item ${activeSessionId === s.id ? 'active' : ''}`}
            >
              <button
                type="button"
                onClick={() => selectSession(s.id)}
                className="chat-session-btn"
              >
                {new Date(s.createdAt).toLocaleString()}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                }}
                className="chat-session-delete"
                title="Delete session"
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
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-main">
        {error && (
          <div className="alert alert-error" style={{ margin: '0.75rem' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!activeSessionId ? (
          <div className="chat-empty">
            <p className="text-muted">Start a new session to begin chatting.</p>
          </div>
        ) : (
          <>
            <div
              className="chat-messages"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {messages.length === 0 && (
                <div className="chat-empty">
                  <p className="text-muted">
                    Send a message to start the conversation.
                  </p>
                </div>
              )}
              {messages.map((msg) => {
                if (msg.role === 'status') {
                  return (
                    <div key={msg.key} className="chat-status">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                      {msg.content}
                    </div>
                  );
                }
                if (msg.role === 'other') {
                  return (
                    <div key={msg.key} className="chat-meta">
                      <span className="chat-meta-label">
                        {msg.toolName || msg.originalRole || 'system'}
                      </span>
                      <span className="chat-meta-content">{msg.content}</span>
                    </div>
                  );
                }
                const hasToolCalls =
                  Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0;
                return (
                  <div key={msg.key}>
                    {(msg.content || !hasToolCalls) && (
                      <div
                        className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'}`}
                      >
                        <div className="chat-message-bubble">
                          {msg.content ? (
                            msg.role === 'assistant' ? (
                              <div className="markdown-content">
                                <Markdown>{msg.content}</Markdown>
                              </div>
                            ) : (
                              msg.content
                            )
                          ) : (
                            <span className="text-muted">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {hasToolCalls &&
                      msg.toolCalls?.map((tc) => (
                        <div key={tc.name} className="chat-meta">
                          <span className="chat-meta-label">tool call</span>
                          <span className="chat-meta-content">
                            {JSON.stringify(tc)}
                          </span>
                        </div>
                      ))}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {!atBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="chat-scroll-btn"
                title="Scroll to bottom"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
            {pendingToolCalls.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  background: 'rgba(31, 41, 55, 0.5)',
                  padding: '0.75rem',
                  maxHeight: '50vh',
                  overflowY: 'auto',
                }}
              >
                <div
                  className="text-xs font-medium"
                  style={{
                    marginBottom: '0.5rem',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Approval required
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {pendingToolCalls.map((tc) => (
                    <div
                      key={tc.id}
                      className="rounded"
                      style={{
                        border: '1px solid var(--border-color)',
                        background: 'rgba(31, 41, 55, 0.3)',
                        padding: '0.75rem',
                      }}
                    >
                      <div
                        className="text-sm font-medium text-primary"
                        style={{ marginBottom: '0.375rem' }}
                      >
                        {tc.name}
                      </div>
                      <pre
                        className="text-xs text-secondary"
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          maxHeight: '8rem',
                          overflowY: 'auto',
                          margin: 0,
                          marginBottom: '0.5rem',
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          background: 'rgba(0, 0, 0, 0.2)',
                        }}
                      >
                        {(() => {
                          try {
                            return JSON.stringify(
                              JSON.parse(tc.arguments),
                              null,
                              2,
                            ).replace(/\\n/g, '\n');
                          } catch {
                            return tc.arguments;
                          }
                        })()}
                      </pre>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          type="button"
                          disabled={approving}
                          onClick={() =>
                            handleToolApproval([
                              { tool_call_id: tc.id, approved: true },
                            ])
                          }
                          className="btn btn-primary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.75rem',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={approving}
                          onClick={() =>
                            handleToolApproval([
                              { tool_call_id: tc.id, approved: false },
                            ])
                          }
                          className="btn"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.75rem',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {pendingToolCalls.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.375rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    <button
                      type="button"
                      disabled={approving}
                      onClick={() =>
                        handleToolApproval(
                          pendingToolCalls.map((tc) => ({
                            tool_call_id: tc.id,
                            approved: true,
                          })),
                        )
                      }
                      className="btn btn-primary flex-1"
                      style={{ fontSize: '0.8rem' }}
                    >
                      Approve All
                    </button>
                    <button
                      type="button"
                      disabled={approving}
                      onClick={() =>
                        handleToolApproval(
                          pendingToolCalls.map((tc) => ({
                            tool_call_id: tc.id,
                            approved: false,
                          })),
                        )
                      }
                      className="btn flex-1"
                      style={{
                        fontSize: '0.8rem',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      Deny All
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="chat-input-area">
              <div className="chat-input-container">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    pendingToolCalls.length > 0
                      ? 'Approve or deny pending tool calls first...'
                      : 'Type a message... (Enter to send, Shift+Enter for newline)'
                  }
                  rows={1}
                  disabled={streaming || pendingToolCalls.length > 0}
                  className="chat-input"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={
                    !input.trim() || streaming || pendingToolCalls.length > 0
                  }
                  className="chat-send-btn"
                  title="Send message"
                >
                  {streaming ? (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19V5m0 0l-7 7m7-7l7 7"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
