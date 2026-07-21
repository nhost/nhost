import type {
  AgentEvent,
  AgentHistoryMessage,
  AgentResponseStream,
  AgentSession,
} from '@nhost/nhost-js/ai';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Send,
  Wrench,
  X,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGFM from 'remark-gfm';
import { Button } from '@/components/ui/v3/button';
import { UserAndRoleSelect } from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect';
import { useAdminNhostClient } from '@/features/orgs/projects/hooks/useAdminNhostClient';
import type { Agent } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/agents';

type ChatEntry =
  | { type: 'user'; id: string; content: string }
  | { type: 'assistant'; id: string; content: string }
  | {
      type: 'tool_use';
      id: string;
      toolCallID?: string;
      name: string;
      input?: unknown;
    }
  | {
      type: 'tool_result';
      id: string;
      toolCallID?: string;
      name: string;
      content: string;
    }
  | {
      type: 'approval_required';
      id: string;
      toolCalls: Array<{
        id: string;
        name: string;
        input: unknown;
      }>;
    }
  | { type: 'error'; id: string; content: string };

function buildHasuraHeaders(
  userID: string,
  role: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (userID) {
    headers['x-hasura-user-id'] = userID;
  }
  if (role) {
    headers['x-hasura-role'] = role;
  }
  return headers;
}

function prettifyToolResult(content: unknown): string {
  if (typeof content !== 'string') {
    return JSON.stringify(content, null, 2);
  }
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function historyToEntries(history: AgentHistoryMessage[]): ChatEntry[] {
  const entries: ChatEntry[] = [];

  for (const message of history) {
    switch (message.type) {
      case 'user':
        entries.push({
          type: 'user',
          id: message.id,
          content: message.content,
        });
        break;
      case 'assistant':
        entries.push({
          type: 'assistant',
          id: message.id,
          content: message.content,
        });
        break;
      case 'tool_call':
        entries.push({
          type: 'tool_use',
          id: crypto.randomUUID(),
          toolCallID: message.toolCallID,
          name: message.name,
          input: message.input,
        });
        break;
      case 'tool_result':
        entries.push({
          type: 'tool_result',
          id: message.id,
          toolCallID: message.toolCallID,
          name: message.toolName,
          content: prettifyToolResult(message.content),
        });
        break;
      default:
        break;
    }
  }

  return entries;
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-end">
      <div className="prose prose-sm prose-invert max-w-[80%] rounded-lg bg-primary prose-pre:bg-background/20 px-4 py-2 prose-pre:text-primary-foreground text-primary-foreground">
        <Markdown remarkPlugins={[remarkGFM]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </Markdown>
      </div>
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-start">
      <div className="prose prose-sm dark:prose-invert max-w-[80%] rounded-lg bg-muted prose-pre:bg-background px-4 py-2 prose-pre:text-foreground">
        <Markdown remarkPlugins={[remarkGFM]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </Markdown>
      </div>
    </div>
  );
}

function ToolPair({
  name,
  input,
  result,
  pending,
}: {
  name: string;
  input?: unknown;
  result?: string;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = input !== undefined || result !== undefined;

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[80%] overflow-hidden rounded-md border bg-muted/30 text-xs">
        <button
          type="button"
          onClick={hasDetails ? () => setExpanded(!expanded) : undefined}
          className="flex w-full items-center gap-1.5 px-2 py-1 text-left"
          disabled={!hasDetails}
        >
          <Wrench className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{name}</span>
          {pending ? (
            <span className="text-muted-foreground">…</span>
          ) : (
            <Check className="h-3 w-3 text-green-600 dark:text-green-500" />
          )}
          {hasDetails &&
            (expanded ? (
              <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
            ))}
        </button>
        {expanded && hasDetails && (
          <div className="space-y-2 border-t bg-background/40 px-2 py-1.5">
            {input !== undefined && (
              <div>
                <p className="mb-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                  Input
                </p>
                <pre className="max-h-40 overflow-auto rounded bg-muted p-1 font-mono">
                  {typeof input === 'string'
                    ? input
                    : JSON.stringify(input, null, 2)}
                </pre>
              </div>
            )}
            {result !== undefined && (
              <div>
                <p className="mb-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                  Result
                </p>
                <pre className="max-h-40 overflow-auto rounded bg-muted p-1 font-mono">
                  {result}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalToolPill({ name, input }: { name: string; input?: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = input !== undefined;

  return (
    <div className="overflow-hidden rounded-md border border-amber-300 bg-background/60 text-xs dark:border-amber-800">
      <button
        type="button"
        onClick={hasDetails ? () => setExpanded(!expanded) : undefined}
        disabled={!hasDetails}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left"
      >
        <Wrench className="h-3 w-3 text-amber-700 dark:text-amber-400" />
        <span className="font-medium">{name}</span>
        {hasDetails &&
          (expanded ? (
            <ChevronDown className="ml-auto h-3 w-3 text-amber-700 dark:text-amber-400" />
          ) : (
            <ChevronRight className="ml-auto h-3 w-3 text-amber-700 dark:text-amber-400" />
          ))}
      </button>
      {expanded && hasDetails && (
        <div className="border-amber-200 border-t bg-muted/30 px-2 py-1.5 dark:border-amber-900">
          <p className="mb-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
            Input
          </p>
          <pre className="max-h-40 overflow-auto rounded bg-muted p-1 font-mono">
            {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ApprovalRequest({
  toolCalls,
  onDecide,
  disabled,
}: {
  toolCalls: Array<{ id: string; name: string; input: unknown }>;
  onDecide: (
    decisions: Array<{ tool_call_id: string; approved: boolean }>,
  ) => void;
  disabled: boolean;
}) {
  const count = toolCalls.length;
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[80%] space-y-2 rounded-md border border-amber-300 bg-amber-50/60 p-2 text-xs dark:border-amber-800 dark:bg-amber-950/30">
        <p className="font-medium text-amber-800 dark:text-amber-300">
          Approval required for {count} tool call{count === 1 ? '' : 's'}
        </p>
        <div className="space-y-1">
          {toolCalls.map((call) => (
            <ApprovalToolPill
              key={call.id}
              name={call.name}
              input={call.input}
            />
          ))}
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-7 px-2 text-xs"
            onClick={() =>
              onDecide(
                toolCalls.map((c) => ({
                  tool_call_id: c.id,
                  approved: true,
                })),
              )
            }
          >
            <Check className="mr-1 h-3 w-3" />
            Approve all
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-7 px-2 text-xs"
            onClick={() =>
              onDecide(
                toolCalls.map((c) => ({
                  tool_call_id: c.id,
                  approved: false,
                })),
              )
            }
          >
            <X className="mr-1 h-3 w-3" />
            Deny all
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorBubble({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[80%] rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-800 text-sm dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {content}
      </div>
    </div>
  );
}

type RenderItem =
  | { kind: 'entry'; key: string; entry: ChatEntry }
  | {
      kind: 'tool';
      key: string;
      name: string;
      input?: unknown;
      result?: string;
      pending: boolean;
    };

function groupEntries(entries: ChatEntry[]): RenderItem[] {
  const consumedResultIds = new Set<string>();
  const items: RenderItem[] = [];

  const findResultIndex = (
    start: number,
    use: Extract<ChatEntry, { type: 'tool_use' }>,
  ) => {
    for (let j = start + 1; j < entries.length; j += 1) {
      const candidate = entries[j];
      if (
        candidate.type !== 'tool_result' ||
        consumedResultIds.has(candidate.id)
      ) {
        continue;
      }
      if (use.toolCallID && candidate.toolCallID) {
        if (use.toolCallID === candidate.toolCallID) {
          return j;
        }
        continue;
      }
      if (candidate.name === use.name) {
        return j;
      }
    }
    return -1;
  };

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];

    if (entry.type === 'tool_result') {
      if (consumedResultIds.has(entry.id)) {
        continue;
      }
      items.push({
        kind: 'tool',
        key: entry.id,
        name: entry.name,
        result: entry.content,
        pending: false,
      });
      continue;
    }

    if (entry.type === 'tool_use') {
      const resultIdx = findResultIndex(i, entry);
      const result =
        resultIdx >= 0
          ? (entries[resultIdx] as Extract<ChatEntry, { type: 'tool_result' }>)
          : undefined;
      if (result) {
        consumedResultIds.add(result.id);
      }
      items.push({
        kind: 'tool',
        key: entry.id,
        name: entry.name,
        input: entry.input,
        result: result?.content,
        pending: !result,
      });
      continue;
    }

    items.push({ kind: 'entry', key: entry.id, entry });
  }

  return items;
}

function ChatEntryRenderer({
  entry,
  onApprovalDecide,
  approvalLoading,
}: {
  entry: ChatEntry;
  onApprovalDecide: (
    decisions: Array<{ tool_call_id: string; approved: boolean }>,
  ) => void;
  approvalLoading: boolean;
}) {
  switch (entry.type) {
    case 'user':
      return <UserBubble content={entry.content} />;
    case 'assistant':
      return <AssistantBubble content={entry.content} />;
    case 'approval_required':
      return (
        <ApprovalRequest
          toolCalls={entry.toolCalls}
          onDecide={onApprovalDecide}
          disabled={approvalLoading}
        />
      );
    case 'error':
      return <ErrorBubble content={entry.content} />;
    default:
      return null;
  }
}

export default function AgentChat({ agent }: { agent: Agent }) {
  const router = useRouter();
  const { adminNhost } = useAdminNhostClient();

  const sessionIdFromUrl =
    typeof router.query.sessionID === 'string' ? router.query.sessionID : null;

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(sessionIdFromUrl);
  const [userId, setUserId] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [resumedUserId, setResumedUserId] = useState<string | undefined>(
    undefined,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedSessionsRef = useRef<Set<string>>(new Set());
  const currentAssistantIdRef = useRef<string | null>(null);
  const sessionRef = useRef<AgentSession | null>(null);
  const activeTurnRef = useRef<{
    id: string;
    controller: AbortController;
  } | null>(null);
  const approvalResolverRef = useRef<{
    turnId: string;
    resolve: (
      decisions: Array<{ toolCallID: string; approved: boolean }>,
    ) => void;
    reject: (reason: unknown) => void;
  } | null>(null);

  const cancelActiveTurn = useCallback(() => {
    const activeTurn = activeTurnRef.current;
    activeTurnRef.current = null;

    const approvalResolver = approvalResolverRef.current;
    approvalResolverRef.current = null;
    approvalResolver?.reject(
      new DOMException('Active agent turn cancelled', 'AbortError'),
    );
    activeTurn?.controller.abort();
    currentAssistantIdRef.current = null;
  }, []);

  const updateSessionInUrl = (newSessionId: string | null) => {
    const { sessionID: _omit, ...rest } = router.query;
    const query = newSessionId ? { ...rest, sessionID: newSessionId } : rest;
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to URL changes
  useEffect(() => {
    if (sessionIdFromUrl !== sessionId) {
      cancelActiveTurn();
      setLoading(false);
      if (sessionIdFromUrl) {
        loadedSessionsRef.current.delete(sessionIdFromUrl);
      }
      setSessionId(sessionIdFromUrl);
      sessionRef.current = null;
      setResumedUserId(undefined);
      setEntries([]);
    }
  }, [sessionIdFromUrl]);

  useEffect(
    () => () => {
      cancelActiveTurn();
    },
    [cancelActiveTurn],
  );

  useEffect(() => {
    if (!sessionId || !adminNhost) {
      return undefined;
    }
    if (loadedSessionsRef.current.has(sessionId)) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const session = await adminNhost.ai.resumeSession({
          sessionID: sessionId,
        });
        if (cancelled) {
          return;
        }
        loadedSessionsRef.current.add(sessionId);
        sessionRef.current = session;
        setEntries(historyToEntries(session.history));
        setResumedUserId(session.userID);
      } catch {
        if (!cancelled) {
          loadedSessionsRef.current.delete(sessionId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, adminNhost]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when entries change
  useEffect(() => {
    scrollToBottom();
  }, [entries]);

  const getOrCreateSession = async (
    signal: AbortSignal,
  ): Promise<AgentSession> => {
    if (!adminNhost) {
      throw new Error('Project not ready');
    }
    if (sessionRef.current) {
      return sessionRef.current;
    }
    if (sessionId) {
      sessionRef.current = adminNhost.ai.agentSession(sessionId, agent.id);
      return sessionRef.current;
    }

    const newSession = await adminNhost.ai.newAgentSession(
      { agentID: agent.id },
      { headers: buildHasuraHeaders(userId, role), signal },
    );
    if (signal.aborted) {
      throw new DOMException('Active agent turn cancelled', 'AbortError');
    }
    sessionRef.current = newSession;
    loadedSessionsRef.current.add(newSession.id);
    setSessionId(newSession.id);
    updateSessionInUrl(newSession.id);
    return newSession;
  };

  const appendToAssistant = (text: string) => {
    if (!text) {
      return;
    }
    const openId = currentAssistantIdRef.current;
    if (openId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === openId && e.type === 'assistant'
            ? { ...e, content: e.content + text }
            : e,
        ),
      );
      return;
    }
    const newId = crypto.randomUUID();
    currentAssistantIdRef.current = newId;
    setEntries((prev) => [
      ...prev,
      { type: 'assistant', id: newId, content: text },
    ]);
  };

  const closeAssistantBubble = () => {
    currentAssistantIdRef.current = null;
  };

  const handleAgentEvent = (event: AgentEvent) => {
    switch (event.type) {
      case 'content_delta':
        appendToAssistant(event.content);
        break;

      case 'tool_use_start':
        closeAssistantBubble();
        setEntries((prev) => [
          ...prev,
          {
            type: 'tool_use',
            id: crypto.randomUUID(),
            toolCallID: event.toolCallID,
            name: event.name,
          },
        ]);
        break;

      case 'tool_call':
        closeAssistantBubble();
        setEntries((prev) => [
          ...prev,
          {
            type: 'tool_use',
            id: crypto.randomUUID(),
            toolCallID: event.toolCallID,
            name: event.name,
            input: event.input,
          },
        ]);
        break;

      case 'tool_result':
        closeAssistantBubble();
        setEntries((prev) => [
          ...prev,
          {
            type: 'tool_result',
            id: crypto.randomUUID(),
            toolCallID: event.toolCallID,
            name: event.toolName,
            content: prettifyToolResult(event.content),
          },
        ]);
        break;

      case 'approval_required':
        closeAssistantBubble();
        setEntries((prev) => [
          ...prev,
          {
            type: 'approval_required',
            id: crypto.randomUUID(),
            toolCalls: event.toolCalls,
          },
        ]);
        break;

      case 'tool_denied':
        closeAssistantBubble();
        setEntries((prev) => [
          ...prev,
          {
            type: 'error',
            id: crypto.randomUUID(),
            content: `Tool denied: ${event.toolName ?? 'unknown'}`,
          },
        ]);
        break;

      case 'error':
        closeAssistantBubble();
        setEntries((prev) => [
          ...prev,
          {
            type: 'error',
            id: crypto.randomUUID(),
            content: `Error: ${event.error}`,
          },
        ]);
        break;

      default:
        break;
    }
  };

  const isActiveTurn = (turnId: string) => activeTurnRef.current?.id === turnId;

  const waitForApprovalDecision = (turnId: string) =>
    new Promise<Array<{ toolCallID: string; approved: boolean }>>(
      (resolve, reject) => {
        approvalResolverRef.current = { turnId, resolve, reject };
      },
    );

  const consumeStream = async (stream: AgentResponseStream, turnId: string) => {
    for await (const event of stream) {
      if (!isActiveTurn(turnId)) {
        return;
      }
      handleAgentEvent(event);
      if (event.type === 'approval_required') {
        const decisions = await waitForApprovalDecision(turnId);
        if (!isActiveTurn(turnId)) {
          return;
        }
        setEntries((prev) =>
          prev.filter((e) => e.type !== 'approval_required'),
        );
        currentAssistantIdRef.current = null;
        await event.respond(decisions);
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !adminNhost) {
      return;
    }

    const userEntry: ChatEntry = {
      type: 'user',
      id: crypto.randomUUID(),
      content: input.trim(),
    };

    const turnId = crypto.randomUUID();
    const controller = new AbortController();
    activeTurnRef.current = { id: turnId, controller };

    setEntries((prev) => [...prev, userEntry]);
    setInput('');
    setLoading(true);

    try {
      const session = await getOrCreateSession(controller.signal);
      if (!isActiveTurn(turnId)) {
        return;
      }
      currentAssistantIdRef.current = null;
      await consumeStream(
        session.sendMessage(userEntry.content, {
          headers: buildHasuraHeaders(userId, role),
          signal: controller.signal,
        }),
        turnId,
      );
    } catch (error) {
      if (!controller.signal.aborted && isActiveTurn(turnId)) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        setEntries((prev) => [
          ...prev,
          { type: 'error', id: crypto.randomUUID(), content: errorMessage },
        ]);
      }
    } finally {
      if (isActiveTurn(turnId)) {
        activeTurnRef.current = null;
        const approvalResolver = approvalResolverRef.current;
        if (approvalResolver?.turnId === turnId) {
          approvalResolverRef.current = null;
        }
        currentAssistantIdRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleApprovalDecide = (
    decisions: Array<{ tool_call_id: string; approved: boolean }>,
  ) => {
    const approvalResolver = approvalResolverRef.current;
    approvalResolverRef.current = null;
    approvalResolver?.resolve(
      decisions.map((d) => ({
        toolCallID: d.tool_call_id,
        approved: d.approved,
      })),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewSession = () => {
    cancelActiveTurn();
    setLoading(false);
    setSessionId(null);
    sessionRef.current = null;
    setResumedUserId(undefined);
    setEntries([]);
    updateSessionInUrl(null);
  };

  const hasPendingApproval = entries.some(
    (e) => e.type === 'approval_required',
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <UserAndRoleSelect
          key={resumedUserId ?? 'unset'}
          onUserChange={setUserId}
          onRoleChange={setRole}
          initialUserId={resumedUserId}
        />
        <Button variant="outline" size="sm" onClick={handleNewSession}>
          New Session
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {entries.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
              Send a message to start chatting with {agent.name}.
            </p>
          </div>
        )}
        {groupEntries(entries).map((item) =>
          item.kind === 'tool' ? (
            <ToolPair
              key={item.key}
              name={item.name}
              input={item.input}
              result={item.result}
              pending={item.pending}
            />
          ) : (
            <ChatEntryRenderer
              key={item.key}
              entry={item.entry}
              onApprovalDecide={handleApprovalDecide}
              approvalLoading={false}
            />
          ),
        )}
        {loading &&
          !hasPendingApproval &&
          entries[entries.length - 1]?.type !== 'assistant' && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-lg bg-muted px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            rows={1}
            disabled={loading || hasPendingApproval}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || loading || hasPendingApproval}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
