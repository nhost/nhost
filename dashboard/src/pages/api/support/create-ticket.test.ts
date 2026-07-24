import type { User } from '@nhost/nhost-js/auth';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { NextApiRequest, NextApiResponse } from 'next';
import { vi } from 'vitest';
import type {
  CreateTicketRequest,
  CreateTicketResponse,
} from './create-ticket';

// The Nhost client captures fetch at module load, so start MSW before importing
// the route to ensure the client uses MSW's patched fetch.
let handler: typeof import('./create-ticket').default;

const AUTH_USER_URL = 'https://local.auth.local.nhost.run/v1/user';
const GRAPHQL_URL = 'https://local.graphql.local.nhost.run/v1';
const ZENDESK_URL = 'https://nhost-test.zendesk.com';
const ZENDESK_TOKEN_URL = `${ZENDESK_URL}/oauth/tokens`;
const ZENDESK_TICKET_URL = `${ZENDESK_URL}/api/v2/requests.json`;

const CLIENT_ID = 'zendesk-client-id';
const CLIENT_SECRET_SENTINEL = 'CLIENT_SECRET_DO_NOT_LEAK';
const ACCESS_TOKEN_SENTINEL = 'ACCESS_TOKEN_DO_NOT_LEAK';
const TOKEN_ERROR_BODY_SENTINEL = 'TOKEN_ERROR_BODY_DO_NOT_LEAK';
const TICKET_ERROR_BODY_SENTINEL = 'TICKET_ERROR_BODY_DO_NOT_LEAK';

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

const validRequestBody = {
  project: 'test-subdomain',
  services: ['Authentication', 'Storage'],
  priority: 'low',
  subject: 'Something is broken',
  description: 'Details about the problem',
  userName: 'Attacker',
  userEmail: 'victim@corp.com',
};

type HandlerResult = {
  status: number;
  body: CreateTicketResponse;
};

type RequestOptions = {
  method?: string;
  body?: Partial<CreateTicketRequest> & Record<string, unknown>;
  authorization?: string | null;
};

type TicketRequest = {
  authorization: string | null;
  body: unknown;
};

let tokenCallCount = 0;
let ticketCallCount = 0;
let tokenRequestBodies: unknown[] = [];
let ticketRequests: TicketRequest[] = [];

const server = setupServer(
  http.get(AUTH_USER_URL, () => HttpResponse.json<User>(mockUser)),
  http.post(GRAPHQL_URL, () =>
    HttpResponse.json({
      data: {
        apps: [{ id: 'app-id', organization: { plan: { slaLevel: 'none' } } }],
      },
    }),
  ),
  http.post(ZENDESK_TOKEN_URL, async ({ request }) => {
    tokenCallCount += 1;
    tokenRequestBodies.push(await request.json());

    return HttpResponse.json({
      access_token: `${ACCESS_TOKEN_SENTINEL}-${tokenCallCount}`,
      token_type: 'bearer',
    });
  }),
  http.post(ZENDESK_TICKET_URL, async ({ request }) => {
    ticketCallCount += 1;
    ticketRequests.push({
      authorization: request.headers.get('authorization'),
      body: await request.json(),
    });

    return HttpResponse.json({}, { status: 201 });
  }),
);

const invokeHandler = async ({
  method = 'POST',
  body = validRequestBody,
  authorization = 'Bearer valid-nhost-token',
}: RequestOptions = {}): Promise<HandlerResult> => {
  const headers = authorization ? { authorization } : {};
  const req = { method, headers, body } as unknown as NextApiRequest;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status } as unknown as NextApiResponse<CreateTicketResponse>;

  await handler(req, res);

  return {
    status: status.mock.calls[0]?.[0] as number,
    body: json.mock.calls[0]?.[0] as CreateTicketResponse,
  };
};

const expectNoZendeskCalls = () => {
  expect(tokenCallCount).toBe(0);
  expect(ticketCallCount).toBe(0);
};

const expectNoSensitiveOutput = (
  result: HandlerResult,
  sentinels: string[] = [
    CLIENT_SECRET_SENTINEL,
    ACCESS_TOKEN_SENTINEL,
    TOKEN_ERROR_BODY_SENTINEL,
    TICKET_ERROR_BODY_SENTINEL,
  ],
) => {
  const output = JSON.stringify({
    response: result,
    logs: vi.mocked(console.error).mock.calls,
  });

  for (const sentinel of sentinels) {
    expect(output).not.toContain(sentinel);
  }
};

describe('POST /api/support/create-ticket', () => {
  beforeAll(async () => {
    server.listen({ onUnhandledRequest: 'error' });
    ({ default: handler } = await import('./create-ticket'));
  });

  beforeEach(() => {
    vi.stubEnv('NEXT_ZENDESK_URL', ZENDESK_URL);
    vi.stubEnv('NEXT_ZENDESK_OAUTH_CLIENT_ID', CLIENT_ID);
    vi.stubEnv('NEXT_ZENDESK_OAUTH_CLIENT_SECRET', CLIENT_SECRET_SENTINEL);
    tokenCallCount = 0;
    ticketCallCount = 0;
    tokenRequestBodies = [];
    ticketRequests = [];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('obtains a token and creates an unchanged ticket for the authenticated requester', async () => {
    const result = await invokeHandler();

    expect(result).toEqual({ status: 200, body: { success: true } });
    expect(tokenCallCount).toBe(1);
    expect(tokenRequestBodies).toEqual([
      {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET_SENTINEL,
        scope: 'requests:write',
        expires_in: 600,
      },
    ]);
    expect(ticketCallCount).toBe(1);
    expect(ticketRequests).toEqual([
      {
        authorization: `Bearer ${ACCESS_TOKEN_SENTINEL}-1`,
        body: {
          request: {
            subject: validRequestBody.subject,
            comment: { body: validRequestBody.description },
            priority: validRequestBody.priority,
            requester: {
              name: mockUser.displayName,
              email: mockUser.email,
            },
            custom_fields: [
              { id: 19502784542098, value: validRequestBody.project },
              {
                id: 19922709880978,
                value: ['authentication', 'storage'],
              },
              { id: 30691138027538, value: 'none' },
            ],
          },
        },
      },
    ]);
    expect(JSON.stringify(ticketRequests)).not.toContain(CLIENT_ID);
    expect(JSON.stringify(ticketRequests)).not.toContain(
      CLIENT_SECRET_SENTINEL,
    );
    expectNoSensitiveOutput(result);
  });

  it('obtains a distinct token for every valid submission', async () => {
    const firstResult = await invokeHandler();
    const secondResult = await invokeHandler();

    expect(firstResult.status).toBe(200);
    expect(secondResult.status).toBe(200);
    expect(tokenCallCount).toBe(2);
    expect(ticketCallCount).toBe(2);
    expect(ticketRequests.map(({ authorization }) => authorization)).toEqual([
      `Bearer ${ACCESS_TOKEN_SENTINEL}-1`,
      `Bearer ${ACCESS_TOKEN_SENTINEL}-2`,
    ]);
  });

  it('accepts an omitted token type and trims the access token', async () => {
    server.use(
      http.post(ZENDESK_TOKEN_URL, async ({ request }) => {
        tokenCallCount += 1;
        tokenRequestBodies.push(await request.json());
        return HttpResponse.json({
          access_token: `  ${ACCESS_TOKEN_SENTINEL}  `,
        });
      }),
    );

    const result = await invokeHandler();

    expect(result.status).toBe(200);
    expect(ticketRequests[0]?.authorization).toBe(
      `Bearer ${ACCESS_TOKEN_SENTINEL}`,
    );
  });

  it('does not call Zendesk for unsupported methods', async () => {
    const result = await invokeHandler({ method: 'GET' });

    expect(result).toEqual({
      status: 405,
      body: { success: false, error: 'Method not allowed' },
    });
    expectNoZendeskCalls();
  });

  it('does not call Zendesk when configuration is missing', async () => {
    vi.stubEnv('NEXT_ZENDESK_OAUTH_CLIENT_SECRET', '');

    const result = await invokeHandler();

    expect(result).toEqual({
      status: 500,
      body: { success: false, error: 'Zendesk configuration is missing' },
    });
    expectNoZendeskCalls();
  });

  it('does not call Zendesk when required fields are missing', async () => {
    const result = await invokeHandler({
      body: { ...validRequestBody, description: '' },
    });

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: 'Missing required fields' },
    });
    expectNoZendeskCalls();
  });

  it('does not call Zendesk when the authorization token is missing', async () => {
    const result = await invokeHandler({ authorization: null });

    expect(result).toEqual({
      status: 401,
      body: { success: false, error: 'Missing authorization token' },
    });
    expectNoZendeskCalls();
  });

  it('does not call Zendesk when the authorization token is invalid', async () => {
    server.use(
      http.get(AUTH_USER_URL, () =>
        HttpResponse.json({ error: 'invalid token' }, { status: 401 }),
      ),
    );

    const result = await invokeHandler();

    expect(result).toEqual({
      status: 401,
      body: { success: false, error: 'Invalid or expired token' },
    });
    expectNoZendeskCalls();
  });

  it('does not call Zendesk when the user has no email address', async () => {
    server.use(
      http.get(AUTH_USER_URL, () =>
        HttpResponse.json<User>({ ...mockUser, email: '' }),
      ),
    );

    const result = await invokeHandler();

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: 'User account has no email address' },
    });
    expectNoZendeskCalls();
  });

  it('does not call Zendesk when the user cannot access the project', async () => {
    server.use(
      http.post(GRAPHQL_URL, () => HttpResponse.json({ data: { apps: [] } })),
    );

    const result = await invokeHandler();

    expect(result).toEqual({
      status: 400,
      body: { success: false, error: 'Invalid project subdomain' },
    });
    expectNoZendeskCalls();
  });

  it('does not call Zendesk when priority is invalid for the SLA', async () => {
    const result = await invokeHandler({
      body: { ...validRequestBody, priority: 'high' },
    });

    expect(result).toEqual({
      status: 400,
      body: {
        success: false,
        error: 'Priority must be "low" for plans without an SLA',
      },
    });
    expectNoZendeskCalls();
  });

  it.each([
    {
      name: 'a non-success status',
      response: () =>
        HttpResponse.json(
          { error: TOKEN_ERROR_BODY_SENTINEL },
          { status: 401 },
        ),
    },
    {
      name: 'a network failure',
      response: () => HttpResponse.error(),
    },
    {
      name: 'invalid JSON',
      response: () =>
        new HttpResponse(TOKEN_ERROR_BODY_SENTINEL, {
          headers: { 'Content-Type': 'application/json' },
        }),
    },
    {
      name: 'a missing access token',
      response: () => HttpResponse.json({ token_type: 'bearer' }),
    },
    {
      name: 'a blank access token',
      response: () =>
        HttpResponse.json({ access_token: '   ', token_type: 'bearer' }),
    },
    {
      name: 'an unsupported token type',
      response: () =>
        HttpResponse.json({
          access_token: ACCESS_TOKEN_SENTINEL,
          token_type: 'mac',
        }),
    },
  ])('returns a sanitized 502 for $name', async ({ response }) => {
    server.use(
      http.post(ZENDESK_TOKEN_URL, () => {
        tokenCallCount += 1;
        return response();
      }),
    );

    const result = await invokeHandler();

    expect(result).toEqual({
      status: 502,
      body: { success: false, error: 'Failed to authenticate with Zendesk' },
    });
    expect(tokenCallCount).toBe(1);
    expect(ticketCallCount).toBe(0);
    expectNoSensitiveOutput(result);
  });

  it.each([
    { status: 403, statusText: '' },
    { status: 422, statusText: 'Unprocessable Entity' },
  ])('preserves a sanitized $status ticket API failure without reading its body', async ({
    status,
    statusText,
  }) => {
    server.use(
      http.post(ZENDESK_TICKET_URL, () => {
        ticketCallCount += 1;
        return HttpResponse.json(
          { error: TICKET_ERROR_BODY_SENTINEL },
          { status, statusText },
        );
      }),
    );

    const result = await invokeHandler();

    expect(result).toEqual({
      status,
      body: {
        success: false,
        error: `Failed to create ticket (Zendesk status ${status})`,
      },
    });
    expect(tokenCallCount).toBe(1);
    expect(ticketCallCount).toBe(1);
    expectNoSensitiveOutput(result);
  });
});
