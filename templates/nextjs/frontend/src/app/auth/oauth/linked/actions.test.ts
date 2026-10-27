import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unlinkProvider } from '@/app/auth/oauth/linked/actions';

const client = vi.hoisted(() => ({
  session: null as object | null,
  verifiedUser: null as { id: string; email?: string } | null,
  graphql: { request: vi.fn() },
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    graphql: client.graphql,
  }),
  getVerifiedUser: async () => client.verifiedUser,
}));

const links = (...ids: string[]) => ({
  body: {
    data: {
      authUserProviders: ids.map((id) => ({
        id,
        providerId: id,
        createdAt: '2026-10-01T00:00:00Z',
      })),
    },
  },
});

const deleted = (id: string | null) => ({
  body: { data: { deleteAuthUserProvider: id ? { id } : null } },
});

beforeEach(() => {
  client.session = { user: { id: 'user-1' } };
  client.verifiedUser = { id: 'user-1', email: 'user@example.com' };
  client.graphql.request.mockReset();
});

describe('unlinkProvider', () => {
  it('deletes the link', async () => {
    client.graphql.request
      .mockResolvedValueOnce(links('github'))
      .mockResolvedValueOnce(deleted('github'));

    expect(await unlinkProvider('github')).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[1][0].variables).toEqual({
      id: 'github',
    });
  });

  // With no address, the email methods cannot sign in, so the provider is the
  // only way back into the account.
  it('keeps the only way in to an account with no email', async () => {
    client.verifiedUser = { id: 'user-1' };
    client.graphql.request.mockResolvedValueOnce(links('github'));

    expect((await unlinkProvider('github')).error).toContain(
      'only way to sign in',
    );
    expect(client.graphql.request).toHaveBeenCalledOnce();
  });
});
