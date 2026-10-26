import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listLinkedAccounts,
  unlinkProvider,
} from '@/app/auth/oauth/linked/actions';

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

describe('listLinkedAccounts', () => {
  it('lists the providers on the account', async () => {
    client.graphql.request.mockResolvedValueOnce(links('github'));

    expect((await listLinkedAccounts()).links).toEqual([
      { id: 'github', providerId: 'github', createdAt: '2026-10-01T00:00:00Z' },
    ]);
  });

  it('names the metadata when the schema lacks the table', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: {
        errors: [
          {
            message:
              "field 'authUserProviders' not found in type: 'query_root'",
          },
        ],
      },
    });

    expect((await listLinkedAccounts()).error).toContain('nhost/metadata');
  });

  it('refuses without a session', async () => {
    client.session = null;

    expect((await listLinkedAccounts()).error).toBe(
      'You are signed out. Sign in and try again.',
    );
  });
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

  it('lets an account with no email drop one of two providers', async () => {
    client.verifiedUser = { id: 'user-1' };
    client.graphql.request
      .mockResolvedValueOnce(links('github', 'google'))
      .mockResolvedValueOnce(deleted('github'));

    expect(await unlinkProvider('github')).toEqual({ success: true });
  });

  it("reports a link that is not this account's", async () => {
    client.graphql.request
      .mockResolvedValueOnce(links('github'))
      .mockResolvedValueOnce(deleted(null));

    expect(await unlinkProvider('someone-elses')).toEqual({
      error: 'That account is not linked to this one.',
    });
  });

  it('refuses when the auth service does not vouch for anyone', async () => {
    client.verifiedUser = null;

    expect((await unlinkProvider('github')).error).toBe(
      'You are signed out. Sign in and try again.',
    );
    expect(client.graphql.request).not.toHaveBeenCalled();
  });
});
