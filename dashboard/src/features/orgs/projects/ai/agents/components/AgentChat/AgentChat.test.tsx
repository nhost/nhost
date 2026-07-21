import type { AgentEvent, AgentResponseStream } from '@nhost/nhost-js/ai';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import AgentChat from '@/features/orgs/projects/ai/agents/components/AgentChat/AgentChat';
import type { Agent } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/agents';
import { mockRouter } from '@/tests/mocks';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';

const adminNhostMocks = vi.hoisted(() => ({
  agentSession: vi.fn(),
  newAgentSession: vi.fn(),
  resumeSession: vi.fn(),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('rehype-highlight', () => ({ default: vi.fn() }));
vi.mock('remark-gfm', () => ({ default: vi.fn() }));

vi.mock('@/features/orgs/projects/hooks/useAdminNhostClient', () => {
  const adminNhost = { ai: adminNhostMocks };

  return {
    useAdminNhostClient: () => ({ adminNhost }),
  };
});

const agent = {
  id: 'agent-id',
  name: 'Test Agent',
} as Agent;

type ApprovalResponder = (
  decisions: Array<{ toolCallID: string; approved: boolean }>,
) => Promise<void>;

function approvalEvent(respond: ApprovalResponder): AgentEvent {
  const toolCalls = [{ id: 'tool-call-id', name: 'lookup', input: {} }];

  return {
    type: 'approval_required',
    toolCalls,
    approveAll: vi.fn(),
    denyAll: vi.fn(),
    approve: vi.fn(),
    deny: vi.fn(),
    respond,
  };
}

function approvalStream(
  respond: ApprovalResponder,
  onFinished: VoidFunction,
): AgentResponseStream {
  return (async function* () {
    try {
      yield approvalEvent(respond);
    } finally {
      onFinished();
    }
  })();
}

function submitMessage(content: string): void {
  const textarea = screen.getByPlaceholderText('Type a message...');
  fireEvent.change(textarea, { target: { value: content } });

  const form = textarea.closest('form');
  if (!form) {
    throw new Error('Chat form not found');
  }
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPointerEvent();
  mockRouter.query = {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
  };
  adminNhostMocks.resumeSession.mockImplementation(
    async ({ sessionID }: { sessionID: string }) => ({
      id: sessionID,
      history: [],
    }),
  );
});

describe('AgentChat session resume', () => {
  it('retries a cancelled resume during the StrictMode effect remount', async () => {
    mockRouter.query = {
      ...mockRouter.query,
      sessionID: 'resumed-session',
    };
    adminNhostMocks.resumeSession.mockResolvedValue({
      id: 'resumed-session',
      userID: 'resumed-user',
      history: [
        {
          type: 'assistant',
          id: 'saved-message',
          content: 'Previously saved answer',
        },
      ],
    });

    render(<AgentChat agent={agent} />, { reactStrictMode: true });

    expect(await screen.findByText('Previously saved answer')).toBeVisible();
    expect(adminNhostMocks.resumeSession).toHaveBeenCalledTimes(2);
  });
});

describe('AgentChat active turn cancellation', () => {
  it('cancels a pending approval and unlocks the new session', async () => {
    const respond = vi.fn<ApprovalResponder>().mockResolvedValue(undefined);
    const streamFinished = vi.fn();
    let requestSignal: AbortSignal | undefined;
    const sendMessage = vi.fn(
      (_message: string, options?: RequestInit): AgentResponseStream => {
        requestSignal = options?.signal ?? undefined;
        return approvalStream(respond, streamFinished);
      },
    );
    adminNhostMocks.newAgentSession.mockResolvedValue({
      id: 'created-session',
      history: [],
      sendMessage,
    });

    render(<AgentChat agent={agent} />);
    submitMessage('Run a tool');

    await screen.findByText('Approval required for 1 tool call');
    fireEvent.click(screen.getByRole('button', { name: 'New Session' }));

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByPlaceholderText('Type a message...')).toBeEnabled();
    expect(
      screen.queryByText('Approval required for 1 tool call'),
    ).not.toBeInTheDocument();
    expect(respond).not.toHaveBeenCalled();
    await waitFor(() => expect(streamFinished).toHaveBeenCalledOnce());
  });

  it('cancels a pending approval when switching sessions', async () => {
    const respond = vi.fn<ApprovalResponder>().mockResolvedValue(undefined);
    const streamFinished = vi.fn();
    let requestSignal: AbortSignal | undefined;
    const sendMessage = vi.fn(
      (_message: string, options?: RequestInit): AgentResponseStream => {
        requestSignal = options?.signal ?? undefined;
        return approvalStream(respond, streamFinished);
      },
    );
    adminNhostMocks.newAgentSession.mockResolvedValue({
      id: 'created-session',
      history: [],
      sendMessage,
    });

    const { rerender } = render(<AgentChat agent={agent} />);
    submitMessage('Wait for approval');
    await screen.findByText('Approval required for 1 tool call');

    mockRouter.query = {
      ...mockRouter.query,
      sessionID: 'switched-session',
    };
    rerender(<AgentChat agent={agent} />);

    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    await waitFor(() => expect(streamFinished).toHaveBeenCalledOnce());
    expect(respond).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Approval required for 1 tool call'),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message...')).toBeEnabled();
  });

  it('aborts the old stream and ignores late events after a session switch', async () => {
    let releaseLateEvent: VoidFunction = () => undefined;
    const lateEvent = new Promise<void>((resolve) => {
      releaseLateEvent = resolve;
    });
    let requestSignal: AbortSignal | undefined;
    const stream: AgentResponseStream = (async function* () {
      yield { type: 'content_delta', content: 'old session response' };
      await lateEvent;
      yield { type: 'content_delta', content: 'stale late response' };
    })();
    const sendMessage = vi.fn(
      (_message: string, options?: RequestInit): AgentResponseStream => {
        requestSignal = options?.signal ?? undefined;
        return stream;
      },
    );
    adminNhostMocks.newAgentSession.mockResolvedValue({
      id: 'created-session',
      history: [],
      sendMessage,
    });

    const { rerender } = render(<AgentChat agent={agent} />);
    submitMessage('Start streaming');
    await screen.findByText('old session response');

    mockRouter.query = {
      ...mockRouter.query,
      sessionID: 'switched-session',
    };
    rerender(<AgentChat agent={agent} />);

    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    await waitFor(() =>
      expect(adminNhostMocks.resumeSession).toHaveBeenCalledWith({
        sessionID: 'switched-session',
      }),
    );
    releaseLateEvent();

    await waitFor(() =>
      expect(screen.queryByText('stale late response')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('old session response')).not.toBeInTheDocument();
  });

  it('aborts the stream and releases a pending approval on unmount', async () => {
    const respond = vi.fn<ApprovalResponder>().mockResolvedValue(undefined);
    const streamFinished = vi.fn();
    let requestSignal: AbortSignal | undefined;
    const sendMessage = vi.fn(
      (_message: string, options?: RequestInit): AgentResponseStream => {
        requestSignal = options?.signal ?? undefined;
        return approvalStream(respond, streamFinished);
      },
    );
    adminNhostMocks.newAgentSession.mockResolvedValue({
      id: 'created-session',
      history: [],
      sendMessage,
    });

    const { unmount } = render(<AgentChat agent={agent} />);
    submitMessage('Run another tool');
    await screen.findByText('Approval required for 1 tool call');

    unmount();

    expect(requestSignal?.aborted).toBe(true);
    expect(respond).not.toHaveBeenCalled();
    await waitFor(() => expect(streamFinished).toHaveBeenCalledOnce());
  });
});
