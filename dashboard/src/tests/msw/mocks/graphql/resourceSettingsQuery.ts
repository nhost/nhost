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
              replicas: 1,
            },
          },
          hasura: {
            resources: {
              compute: {
                cpu: 2000,
                memory: 4096,
              },
              replicas: 1,
            },
          },
          auth: {
            resources: {
              compute: {
                cpu: 2000,
                memory: 4096,
              },
              replicas: 1,
            },
          },
          storage: {
            resources: {
              compute: {
                cpu: 2000,
                memory: 4096,
              },
              replicas: 1,
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
              replicas: 1,
            },
          },
          hasura: {
            resources: {
              compute: {
                cpu: 2250,
                memory: 4608,
              },
              replicas: 1,
            },
          },
          auth: {
            resources: {
              compute: {
                cpu: 2250,
                memory: 4608,
              },
              replicas: 1,
            },
          },
          storage: {
            resources: {
              compute: {
                cpu: 2250,
                memory: 4608,
              },
              replicas: 1,
            },
          },
        },
      }),
    ),
);
