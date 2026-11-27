import { print } from 'graphql';
import type { ClientOptions } from 'graphql-ws';
import { vi } from 'vitest';
import { useSupportSubscription } from '@/features/support/hooks/useSupportSubscription';
import { DashboardSupportTicketChangesDocument } from '@/generated/graphql';
import { mockSession } from '@/tests/mocks';
import { act, Providers, renderHook, waitFor } from '@/tests/testUtils';

interface Sink {
  next: (result: { data?: unknown }) => void;
  error: (error: unknown) => void;
  complete: VoidFunction;
}
const ws = vi.hoisted(() => ({
  clients: [] as {
    options: ClientOptions;
    subscribe: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock('graphql-ws', () => ({
  createClient: (options: ClientOptions) => {
    const unsubscribe = vi.fn();
    const client = {
      options,
      subscribe: vi.fn(() => unsubscribe),
      dispose: vi.fn(),
      unsubscribe,
    };
    ws.clients.push(client);
    return client;
  },
}));

const ticketId = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
const originalToken = mockSession.accessToken;
const originalClaims = structuredClone(mockSession.decodedToken);

function authorize(roles: string[]) {
  const claims = {
    'x-hasura-user-id': mockSession.user!.id,
    'x-hasura-default-role': 'user',
    'x-hasura-allowed-roles': roles,
  };
  mockSession.decodedToken = {
    ...originalClaims,
    'https://hasura.io/jwt/claims': claims,
  };
  mockSession.accessToken = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: mockSession.user!.id, exp: Math.floor(Date.now() / 1000) + 3600, 'https://hasura.io/jwt/claims': claims }))}.test-signature`;
}

beforeEach(() => {
  ws.clients = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  mockSession.accessToken = originalToken;
  mockSession.decodedToken = structuredClone(originalClaims);
});

function sinkAt(index: number) {
  return ws.clients[0].subscribe.mock.calls[index][1] as Sink;
}

describe('useSupportSubscription', () => {
  it.each([
    { roles: ['user'], role: 'user' },
    { roles: ['user', 'support'], role: 'support' },
  ])(
    'subscribes over a WebSocket with the session token and the $role role',
    async ({ roles, role }) => {
      authorize(roles);
      const onData = vi.fn();
      const onReconnect = vi.fn();
      const { unmount } = renderHook(
        () =>
          useSupportSubscription({
            document: DashboardSupportTicketChangesDocument,
            variables: { id: ticketId },
            onData,
            onReconnect,
          }),
        { wrapper: Providers },
      );
      await waitFor(() => expect(ws.clients).toHaveLength(1));
      const [client] = ws.clients;
      expect(client.options.url).toBe('wss://local.graphql.local.nhost.run/v1');
      const params = client.options.connectionParams as () => Promise<unknown>;
      await expect(params()).resolves.toEqual({
        headers: {
          Authorization: `Bearer ${mockSession.accessToken}`,
          'x-hasura-role': role,
        },
      });

      const [operation, sink] = client.subscribe.mock.calls[0] as [
        unknown,
        Sink,
      ];
      expect(operation).toEqual({
        query: print(DashboardSupportTicketChangesDocument),
        variables: { id: ticketId },
      });
      const data = { supportTicket: null };
      act(() => sink.next({ data }));
      expect(onData).toHaveBeenCalledWith(data);

      const connected = client.options.on!.connected!;
      connected({}, undefined, false);
      expect(onReconnect).not.toHaveBeenCalled();
      connected({}, undefined, true);
      expect(onReconnect).toHaveBeenCalledTimes(1);

      unmount();
      expect(client.unsubscribe).toHaveBeenCalled();
      expect(client.dispose).toHaveBeenCalled();
    },
  );

  it('resubscribes only when the variables change', async () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) =>
        useSupportSubscription({
          document: DashboardSupportTicketChangesDocument,
          variables: { id },
          onData: vi.fn(),
        }),
      { wrapper: Providers, initialProps: { id: ticketId } },
    );
    await waitFor(() => expect(ws.clients).toHaveLength(1));
    rerender({ id: ticketId });
    expect(ws.clients).toHaveLength(1);
    rerender({ id: 'another-ticket' });
    await waitFor(() => expect(ws.clients).toHaveLength(2));
    expect(ws.clients[0].dispose).toHaveBeenCalled();
  });

  it.each([
    {
      end: 'error',
      endSubscription: (sink: Sink) =>
        sink.error([{ message: 'executing subscription poll' }]),
    },
    {
      end: 'complete',
      endSubscription: (sink: Sink) => sink.complete(),
    },
  ])(
    'subscribes again after an unexpected $end and refreshes once data arrives',
    async ({ endSubscription }) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const onData = vi.fn();
      const onReconnect = vi.fn();
      renderHook(
        () =>
          useSupportSubscription({
            document: DashboardSupportTicketChangesDocument,
            variables: { id: ticketId },
            onData,
            onReconnect,
          }),
        { wrapper: Providers },
      );
      await waitFor(() => expect(ws.clients).toHaveLength(1));
      const [client] = ws.clients;
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      act(() => endSubscription(sinkAt(0)));
      act(() => vi.advanceTimersByTime(999));
      expect(client.subscribe).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1));
      expect(client.subscribe).toHaveBeenCalledTimes(2);
      expect(ws.clients).toHaveLength(1);
      expect(client.subscribe.mock.calls[1][0]).toEqual({
        query: print(DashboardSupportTicketChangesDocument),
        variables: { id: ticketId },
      });
      expect(onReconnect).not.toHaveBeenCalled();

      const data = { supportTicket: null };
      act(() => sinkAt(1).next({ data }));
      expect(onReconnect).toHaveBeenCalledTimes(1);
      expect(onData).toHaveBeenCalledWith(data);
      act(() => sinkAt(1).next({ data }));
      expect(onReconnect).toHaveBeenCalledTimes(1);

      // Data resets the backoff; repeated failures without data double it.
      act(() => endSubscription(sinkAt(1)));
      act(() => vi.advanceTimersByTime(1000));
      expect(client.subscribe).toHaveBeenCalledTimes(3);
      act(() => endSubscription(sinkAt(2)));
      act(() => vi.advanceTimersByTime(1999));
      expect(client.subscribe).toHaveBeenCalledTimes(3);
      act(() => vi.advanceTimersByTime(1));
      expect(client.subscribe).toHaveBeenCalledTimes(4);
    },
  );

  it('does not subscribe again after unmounting during the backoff', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(
      () =>
        useSupportSubscription({
          document: DashboardSupportTicketChangesDocument,
          variables: { id: ticketId },
          onData: vi.fn(),
        }),
      { wrapper: Providers },
    );
    await waitFor(() => expect(ws.clients).toHaveLength(1));
    const [client] = ws.clients;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    act(() => sinkAt(0).error([{ message: 'executing subscription poll' }]));
    unmount();
    act(() => vi.advanceTimersByTime(30000));
    expect(client.subscribe).toHaveBeenCalledTimes(1);
    expect(client.dispose).toHaveBeenCalled();
    act(() => sinkAt(0).complete());
    act(() => vi.advanceTimersByTime(30000));
    expect(client.subscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores the dispose rejection when unmounting during a reconnect', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      const { unmount } = renderHook(
        () =>
          useSupportSubscription({
            document: DashboardSupportTicketChangesDocument,
            variables: { id: ticketId },
            onData: vi.fn(),
          }),
        { wrapper: Providers },
      );
      await waitFor(() => expect(ws.clients).toHaveLength(1));
      const [client] = ws.clients;
      const dispose = vi.fn();
      // vi.fn handles the promises it returns, which would hide the rejection.
      Object.assign(client, {
        dispose: () => {
          dispose();
          return Promise.reject({
            code: 1000,
            reason: 'All Subscriptions Gone',
          });
        },
      });

      unmount();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(dispose).toHaveBeenCalled();
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  it('does not connect while disabled', async () => {
    renderHook(
      () =>
        useSupportSubscription({
          document: DashboardSupportTicketChangesDocument,
          variables: { id: ticketId },
          enabled: false,
          onData: vi.fn(),
        }),
      { wrapper: Providers },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ws.clients).toHaveLength(0);
  });
});
