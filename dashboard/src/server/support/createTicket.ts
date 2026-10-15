import { FetchError } from '@nhost/nhost-js/fetch';
import { Sla_Level_Enum } from '@/generated/graphql';
import { nhostRoutesClient } from '@/utils/nhost';

export type CreateTicketRequest = {
  project: string;
  services: string[];
  priority: string;
  subject: string;
  description: string;
};

export type CreateTicketResponse = {
  success: boolean;
  error?: string;
};

export interface CreateTicketHttpRequest {
  method: string;
  /** Value of the `Authorization` header. */
  authorization?: string;
  body: unknown;
}

export interface CreateTicketHttpResponse {
  status: number;
  body: CreateTicketResponse;
}

export interface ZendeskConfig {
  url?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}

type GetProjectResponse = {
  apps: Array<{
    id: string;
    organization: {
      plan: {
        slaLevel: string | null;
      } | null;
    } | null;
  }>;
};

type ZendeskTokenResult =
  | { success: true; accessToken: string }
  | { success: false };

const getZendeskAccessToken = async (
  zendeskUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<ZendeskTokenResult> => {
  let response: Response;

  try {
    response = await fetch(`${zendeskUrl}/oauth/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'requests:write',
        expires_in: 600,
      }),
    });
  } catch {
    console.error('Zendesk OAuth token request failed');
    return { success: false };
  }

  if (!response.ok) {
    console.error('Zendesk OAuth token request failed', response.status);
    return { success: false };
  }

  let tokenResponse: unknown;

  try {
    tokenResponse = await response.json();
  } catch {
    console.error(
      'Zendesk OAuth token response parsing failed',
      response.status,
    );
    return { success: false };
  }

  if (
    typeof tokenResponse !== 'object' ||
    tokenResponse === null ||
    Array.isArray(tokenResponse)
  ) {
    console.error(
      'Zendesk OAuth token response validation failed',
      response.status,
    );
    return { success: false };
  }

  const accessTokenValue =
    'access_token' in tokenResponse ? tokenResponse.access_token : undefined;
  const accessToken =
    typeof accessTokenValue === 'string' ? accessTokenValue.trim() : '';
  const hasInvalidTokenType =
    'token_type' in tokenResponse &&
    (typeof tokenResponse.token_type !== 'string' ||
      tokenResponse.token_type.toLowerCase() !== 'bearer');

  if (!accessToken || hasInvalidTokenType) {
    console.error(
      'Zendesk OAuth token response validation failed',
      response.status,
    );
    return { success: false };
  }

  return { success: true, accessToken };
};

/**
 * Creates a Zendesk support ticket on behalf of the signed-in user. Runs on a
 * server (it needs the Zendesk OAuth client secret); how it's exposed over
 * HTTP is decided by the deployment, not by this module.
 */
export default async function createTicket(
  req: CreateTicketHttpRequest,
  zendesk: ZendeskConfig,
): Promise<CreateTicketHttpResponse> {
  if (req.method !== 'POST') {
    return {
      status: 405,
      body: { success: false, error: 'Method not allowed' },
    };
  }

  try {
    const { project, services, priority, subject, description } =
      req.body as CreateTicketRequest;

    if (!zendesk.oauthClientId || !zendesk.oauthClientSecret || !zendesk.url) {
      return {
        status: 500,
        body: {
          success: false,
          error: 'Zendesk configuration is missing',
        },
      };
    }

    if (!project || !services || !priority || !subject || !description) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Missing required fields',
        },
      };
    }

    const token = req.authorization?.split(' ')[1];

    if (!token) {
      return {
        status: 401,
        body: {
          success: false,
          error: 'Missing authorization token',
        },
      };
    }

    let requesterName: string;
    let requesterEmail: string;

    try {
      const { body: user } = await nhostRoutesClient.auth.getUser({
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (user.isAnonymous || !user.email) {
        return {
          status: 400,
          body: {
            success: false,
            error: 'User account has no email address',
          },
        };
      }

      requesterEmail = user.email;
      requesterName = user.displayName || user.email;
    } catch (error) {
      if (error instanceof FetchError) {
        return {
          status: 401,
          body: {
            success: false,
            error: 'Invalid or expired token',
          },
        };
      }
      throw error;
    }

    let slaLevel: string | null = null;

    try {
      const resp = await nhostRoutesClient.graphql.request<GetProjectResponse>(
        {
          query: `query GetProject($subdomain: String!){
            apps(where: {subdomain: {_eq: $subdomain}}) {
              id
              organization {
                plan {
                  slaLevel
                }
              }
            }
          }`,
          variables: {
            subdomain: project,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (resp.body.data?.apps.length !== 1) {
        return {
          status: 400,
          body: {
            success: false,
            error: 'Invalid project subdomain',
          },
        };
      }

      slaLevel = resp.body.data.apps[0]?.organization?.plan?.slaLevel ?? null;
    } catch {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Invalid project subdomain',
        },
      };
    }

    if (
      (slaLevel === Sla_Level_Enum.None || slaLevel === null) &&
      priority !== 'low'
    ) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Priority must be "low" for plans without an SLA',
        },
      };
    }

    const tokenResult = await getZendeskAccessToken(
      zendesk.url,
      zendesk.oauthClientId,
      zendesk.oauthClientSecret,
    );

    if (!tokenResult.success) {
      return {
        status: 502,
        body: {
          success: false,
          error: 'Failed to authenticate with Zendesk',
        },
      };
    }

    let response: Response;

    try {
      response = await fetch(`${zendesk.url}/api/v2/requests.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
        body: JSON.stringify({
          request: {
            subject,
            comment: {
              body: description,
            },
            priority,
            requester: {
              name: requesterName,
              email: requesterEmail,
            },
            custom_fields: [
              {
                id: 19502784542098, // Project Subdomain
                value: project,
              },
              {
                id: 19922709880978, // Affected Services
                value: services.map((service) => service.toLowerCase()),
              },
              {
                id: 30691138027538, // SLA
                value: slaLevel,
              },
            ],
          },
        }),
      });
    } catch {
      console.error('Zendesk ticket request failed');
      return {
        status: 500,
        body: {
          success: false,
          error: 'An unexpected error occurred',
        },
      };
    }

    if (!response.ok) {
      console.error('Zendesk ticket request failed', response.status);
      return {
        status: response.status,
        body: {
          success: false,
          error: `Failed to create ticket (Zendesk status ${response.status})`,
        },
      };
    }

    return { status: 200, body: { success: true } };
  } catch {
    console.error('Unexpected support ticket error');
    return {
      status: 500,
      body: {
        success: false,
        error: 'An unexpected error occurred',
      },
    };
  }
}
