import nhostGraphQLLink from './nhostGraphQLLink';

/**
 * Use this handler to simulate the initial state of the allocated resources.
 */
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

/**
 * Use this handler to simulate the initial state of the allocated resources.
 */
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
                cpu: 2000,
                memory: 4096,
              },
            },
          },
          hasura: {
            resources: {
              compute: {
                cpu: 2000,
                memory: 4096,
              },
            },
          },
          auth: {
            resources: {
              compute: {
                cpu: 2000,
                memory: 4096,
              },
            },
          },
          storage: {
            resources: {
              compute: {
                cpu: 2000,
                memory: 4096,
              },
            },
          },
        },
      }),
    ),
);

/**
 * Use this handler to simulate a change in the allocated resources.
 */
export const resourcesUpdatedQuery = nhostGraphQLLink.query(
  'GetResources',
  (_req, res, ctx) =>
    res(
      ctx.data({
        config: {
          __typename: 'ConfigConfig',
          postgres: {
            resources: {
              compute: {
                cpu: 2250,
                memory: 4608,
              },
            },
          },
          hasura: {
            resources: {
              compute: {
                cpu: 2250,
                memory: 4608,
              },
            },
          },
          auth: {
            resources: {
              compute: {
                cpu: 2250,
                memory: 4608,
              },
            },
          },
          storage: {
            resources: {
              compute: {
                cpu: 2250,
                memory: 4608,
              },
            },
          },
        },
      }),
    ),
);
