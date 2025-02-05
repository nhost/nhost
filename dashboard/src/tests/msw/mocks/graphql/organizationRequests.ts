import nhostGraphQLLink from './nhostGraphQLLink';

export const organizationMemberInvites = nhostGraphQLLink.query(
  'organizationMemberInvites',
  (_req, res, ctx) => res(ctx.data({ organizationMemberInvites: [] })),
);

export const organizationNewRequests = nhostGraphQLLink.query(
  'organizationNewRequests',
  (_req, res, ctx) =>
    res(
      ctx.data({
        organizationNewRequests: [
          {
            id: 'org-request-id-1',
            sessionID: 'session-id-1',
            __typename: 'organization_new_request',
          },
        ],
      }),
    ),
);
