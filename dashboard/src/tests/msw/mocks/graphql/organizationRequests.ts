import { HttpResponse } from 'msw';
import nhostGraphQLLink from './nhostGraphQLLink';

export const organizationMemberInvites = nhostGraphQLLink.query(
  'organizationMemberInvites',
  () => HttpResponse.json({ data: { organizationMemberInvites: [] } }),
);

export const organizationNewRequests = nhostGraphQLLink.query(
  'organizationNewRequests',
  () =>
    HttpResponse.json({
      data: {
        organizationNewRequests: [
          {
            id: 'org-request-id-1',
            sessionID: 'session-id-1',
            __typename: 'organization_new_request',
          },
        ],
      },
    }),
);
