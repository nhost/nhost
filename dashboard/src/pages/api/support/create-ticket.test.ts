import type { User } from '@nhost/nhost-js/auth';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { NextApiRequest, NextApiResponse } from 'next';
import { vi } from 'vitest';
import type { CreateTicketResponse } from './create-ticket';

// the handler is imported dynamically after MSW starts: the Nhost SDK
// captures the global fetch when its client is created at module load, so a
// static import would create the client before MSW can patch fetch
let handler: typeof import('./create-ticket').default;

const AUTH_USER_URL = 'https://local.auth.local.nhost.run/v1/user';
const GRAPHQL_URL = 'https://local.graphql.local.nhost.run/v1';
const ZENDESK_URL = 'https://nhost-test.zendesk.com';

const mockUser: User = {
  avatarUrl: '',
  createdAt: '2024-01-15T12:34:56Z',
  defaultRole: 'user',
  displayName: 'Real User',
  email: 'real-user@nhost.io',
  emailVerified: true,
  id: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
  isAnonymous: false,
  locale: 'en',
  metadata: {},
  phoneNumberVerified: false,
  roles: ['user'],
};

type ZendeskTicketPayload = {
  request: {
    requester: {
      name: string;
      email: string;
    };
  };
};

let zendeskPayload: ZendeskTicketPayload | null = null;

const server = setupServer(
  http.get(AUTH_USER_URL, () => HttpResponse.json<User>(mockUser)),
  http.post(GRAPHQL_URL, () =>
    HttpResponse.json({
      data: {
        apps: [{ id: 'app-id', organization: { plan: { slaLevel: 'none' } } }],
      },
    }),
  ),
  http.post(`${ZENDESK_URL}/api/v2/requests.json`, async ({ request }) => {
    zendeskPayload = (await request.json()) as ZendeskTicketPayload;
    return HttpResponse.json({}, { status: 201 });
  }),
);

describe('POST /api/support/create-ticket', () => {
  beforeAll(async () => {
    vi.stubEnv('NEXT_ZENDESK_USER_EMAIL', 'support@nhost.io');
    vi.stubEnv('NEXT_ZENDESK_API_KEY', 'zendesk-api-key');
    vi.stubEnv('NEXT_ZENDESK_URL', ZENDESK_URL);
    server.listen({ onUnhandledRequest: 'error' });
    ({ default: handler } = await import('./create-ticket'));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    server.close();
  });

  it('creates the ticket with the token owner as requester, ignoring spoofed body fields', async () => {
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        project: 'test-subdomain',
        services: ['Authentication'],
        priority: 'low',
        subject: 'Something is broken',
        description: 'Details about the problem',
        // spoofed requester fields that the handler must ignore
        userName: 'Attacker',
        userEmail: 'victim@corp.com',
      },
    } as unknown as NextApiRequest;

    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as NextApiResponse<CreateTicketResponse>;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(zendeskPayload?.request.requester).toEqual({
      name: 'Real User',
      email: 'real-user@nhost.io',
    });
  });
});
