import nhostGraphQLLink from './nhostGraphQLLink';

export const resourcesUnavailableQuery = nhostGraphQLLink.query(
  'GetResources',
  (_req, res, ctx) =>
    res(
      ctx.data({
        config: {
          __typename: 'ConfigConfig',
          postgres: {
            resources: null,
          },
          hasura: {
            resources: null,
          },
          auth: {
            resources: null,
          },
          storage: {
            resources: null,
          },
        },
      }),
    ),
);

export const resourcesAvailableQuery = nhostGraphQLLink.query(
  'GetResources',
  (_req, res, ctx) =>
    res(
      ctx.data({
        config: {
          __typename: 'ConfigConfig',
          postgres: {
            resources: {
              compute: {
                cpu: 2,
                memory: 4,
              },
            },
          },
          hasura: {
            resources: {
              compute: {
                cpu: 2,
                memory: 4,
              },
            },
          },
          auth: {
            resources: {
              compute: {
                cpu: 2,
                memory: 4,
              },
            },
          },
          storage: {
            resources: {
              compute: {
                cpu: 2,
                memory: 4,
              },
            },
          },
        },
      }),
    ),
);
