import nhostGraphQLLink from './nhostGraphQLLink';

export const prefetchNewAppQuery = nhostGraphQLLink.query(
  'PrefetchNewApp',
  (_req, res, ctx) =>
    res(
      ctx.data({
        regions: [
          {
            id: 'dd6f8e01-35a9-4ba6-8dc6-ed972f2db93c',
            city: 'Frankfurt',
            active: true,
            country: { code: 'DE', name: 'Germany', __typename: 'countries' },
            __typename: 'regions',
          },
          {
            id: 'd44dc594-022f-4aa7-84b2-0cebee5f1d13',
            city: 'London',
            active: false,
            country: {
              code: 'GB',
              name: 'United Kingdom',
              __typename: 'countries',
            },
            __typename: 'regions',
          },
          {
            id: '55985cd4-af14-4d2a-90a5-2a1253ebc1db',
            city: 'N. Virginia',
            active: true,
            country: {
              code: 'US',
              name: 'United States of America',
              __typename: 'countries',
            },
            __typename: 'regions',
          },
          {
            id: '8fe50a9b-ef48-459c-9dd0-a2fd28968224',
            city: 'Singapore',
            active: false,
            country: { code: 'SG', name: 'Singapore', __typename: 'countries' },
            __typename: 'regions',
          },
        ],
        plans: [
          {
            id: 'dc5e805e-1bef-4d43-809e-9fdf865e211a',
            name: 'Pro',
            isDefault: false,
            isFree: false,
            price: 25,
            featureBackupEnabled: true,
            featureCustomDomainsEnabled: true,
            featureMaxDbSize: 10,
            __typename: 'plans',
          },
          {
            id: '9860b992-5658-4031-8580-d8135e18db7c',
            name: 'Team',
            isDefault: false,
            isFree: false,
            price: 599,
            featureBackupEnabled: true,
            featureCustomDomainsEnabled: true,
            featureMaxDbSize: 10,
            __typename: 'plans',
          },
        ],
        workspaces: [],
      }),
    ),
);
