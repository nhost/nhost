import { print } from 'graphql';
import type { ClientOptions } from 'graphql-ws';
import { vi } from 'vitest';
import { useSupportSubscription } from '@/features/support/hooks/useSupportSubscription';
import { DashboardSupportTicketChangesDocument } from '@/generated/graphql';
import { mockSession } from '@/tests/mocks';
import { act, Providers, renderHook, waitFor } from '@/tests/testUtils';

interface Sink {
  next: (result: { data?: unknown }) => void;
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
  mockSession.accessToken = originalToken;
  mockSession.decodedToken = structuredClone(originalClaims);
});

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
