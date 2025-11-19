import { Sla_Level_Enum } from '@/utils/__generated__/graphql';
import { nhostRoutesClient } from '@/utils/nhost';
import type { NextApiRequest, NextApiResponse } from 'next';
i
export type CreateTicketRequest = {
  project: string;
  services: Array<{ label: string; value: string }>;
  priority: string;
  subject: string;
  description: string;
  userName: string;
  userEmail: string;
};

export type CreateTicketResponse = {
  success: boolean;
  error?: string;
};

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateTicketResponse>,
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      project,
      services,
      priority,
      subject,
      description,
      userName,
      userEmail,
    } = req.body as CreateTicketRequest;

    // Validate required environment variables
    if (
      !process.env.NEXT_ZENDESK_USER_EMAIL ||
      !process.env.NEXT_ZENDESK_API_KEY ||
      !process.env.NEXT_ZENDESK_URL
    ) {
      return res.status(500).json({
        success: false,
        error: 'Zendesk configuration is missing',
      });
    }

    // Validate required fields
    if (
      !project ||
      !services ||
      !priority ||
      !subject ||
      !description ||
      !userName ||
      !userEmail
    ) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const token = req.headers.authorization?.split(' ')[1];

    let slaLevel: string | null = null;

    try {
      // we use this to verify the owner of the JWT token has access to the project
      // and fetch the organization's plan slaLevel
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
        return res.status(400).json({
          success: false,
          error: 'Invalid project subdomain',
        });
      }

      slaLevel = resp.body.data.apps[0]?.organization?.plan?.slaLevel ?? null;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project subdomain',
      });
    }

    // validate priority based on sla level
    if ((slaLevel === Sla_Level_Enum.None || slaLevel === null) && priority !== 'low') {
      return res.status(400).json({
        success: false,
        error: 'Priority must be "low" for plans without an SLA',
      });
    }

    const auth = btoa(
      `${process.env.NEXT_ZENDESK_USER_EMAIL}/token:${process.env.NEXT_ZENDESK_API_KEY}`,
    );

    const response = await fetch(
      `${process.env.NEXT_ZENDESK_URL}/api/v2/requests.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          request: {
            subject,
            comment: {
              body: description,
            },
            priority,
            requester: {
              name: userName,
              email: userEmail,
            },
            custom_fields: [
              // these custom field IDs come from zendesk
              {
                id: 19502784542098, // field Project Subdomain
                value: project,
              },
              {
                id: 19922709880978, // field Affected Services
                value: services.map((service) => service.value?.toLowerCase()),
              },
              {
                id: 30691138027538,  // field SLA 
                value: slaLevel,
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zendesk API error:', errorText);
      return res.status(response.status).json({
        success: false,
        error: `Failed to create ticket: ${response.statusText}`,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
    });
  }
}
