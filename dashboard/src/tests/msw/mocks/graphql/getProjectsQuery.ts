import nhostGraphQLLink from './nhostGraphQLLink';

export const getProjectsQuery = nhostGraphQLLink.query(
  'getProjects',
  (_req, res, ctx) =>
    res(
      ctx.data({
        apps: [
          {
            id: 'pitr-usa-id',
            name: 'pitr-not-enabled-usa',
            slug: 'pitr-not-enabled-usa',
            createdAt: '2025-03-10T12:35:23.193578+00:00',
            subdomain: 'ocrnpctsphttfxkuefyx',
            region: {
              id: '1',
              name: 'us-east-1',
              __typename: 'regions',
            },
            deployments: [],
            creator: {
              id: 'creator-r-elek-id',
              email: 'robert@elek.com',
              displayName: 'Robert',
              __typename: 'users',
            },
            appStates: [
              {
                id: 'cd2b77ac-3ef1-4a76-819b-ff1caca09213',
                appId: 'pitr-usa-id',
                message:
                  'failed to get dns manager: unknown region: 55985cd4-af14-4d2a-90a5-2a1253ebc1db',
                stateId: 8,
                createdAt: '2025-03-10T12:39:23.734345+00:00',
                __typename: 'appStateHistory',
              },
            ],
            __typename: 'apps',
          },
          {
            id: 'pitr-region-TEST-eu-id',
            name: 'pitr-region-test-eu',
            slug: 'pitr-region-test-eu',
            createdAt: '2025-03-10T12:45:40.813234+00:00',
            subdomain: 'doszbxwibtopsbfgbjpg',
            region: {
              id: 'dd6f8e01-35a9-4ba6-8dc6-ed972f2db93c',
              name: 'eu-central-1',
              __typename: 'regions',
            },
            deployments: [],
            creator: {
              id: 'creator-r-elek-id',
              email: 'robert@elek.com',
              displayName: 'Robert',
              __typename: 'users',
            },
            appStates: [
              {
                id: 'c7fbf7ad-b60c-432b-86c2-5a9509054c47',
                appId: 'pitr-region-TEST-eu-id',
                message: '',
                stateId: 5,
                createdAt: '2025-03-12T11:08:59.926611+00:00',
                __typename: 'appStateHistory',
              },
            ],
            __typename: 'apps',
          },
          {
            id: 'pitr-test-id',
            name: 'pitr-test',
            slug: 'pitr-test',
            createdAt: '2025-03-04T13:48:59.76498+00:00',
            subdomain: 'gnlivtcgjxctuujxpslj',
            region: {
              id: '1',
              name: 'us-east-1',
              __typename: 'regions',
            },
            deployments: [],
            creator: {
              id: 'creator-d-elek-id',
              email: 'dbarrosop@dravetech.com',
              displayName: 'David Elek',
              __typename: 'users',
            },
            appStates: [
              {
                id: 'fc344bc6-1c59-447a-813f-e0f65754b0e0',
                appId: 'pitr-test-id',
                message:
                  'failed to deploy application to kubernetes: failed to deploy application: failed to check rollout status: error running kubectl: exit status 1',
                stateId: 8,
                createdAt: '2025-03-11T15:34:41.25304+00:00',
                __typename: 'appStateHistory',
              },
            ],
            __typename: 'apps',
          },
          {
            id: 'pitr14-id',
            name: 'pitr14',
            slug: 'pitr14',
            createdAt: '2025-02-25T08:55:22.82937+00:00',
            subdomain: 'jqumebxpocjytrhevonb',
            region: {
              id: '1',
              name: 'us-east-1',
              __typename: 'regions',
            },
            deployments: [],
            creator: {
              id: 'creator-d-elek-id',
              email: 'david@elek.com',
              displayName: 'David Elek',
              __typename: 'users',
            },
            appStates: [
              {
                id: '04bc2db3-a948-48fb-b674-7a8a0133dd2b',
                appId: 'pitr14-id',
                message: '',
                stateId: 5,
                createdAt: '2025-03-11T20:47:03.102948+00:00',
                __typename: 'appStateHistory',
              },
            ],
            __typename: 'apps',
          },
        ],
      }),
    ),
);

export const getEmptyProjectsQuery = nhostGraphQLLink.query(
  'getProjects',
  (_req, res, ctx) =>
    res(
      ctx.data({
        apps: [],
      }),
    ),
);
