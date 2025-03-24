import nhostGraphQLLink from './nhostGraphQLLink';

export const getPostgresSettings = nhostGraphQLLink.query(
  'GetPostgresSettings',
  (_req, res, ctx) =>
    res(
      ctx.data({
        systemConfig: {
          postgres: {
            database: 'gnlivtcgjxctuujxpslj',
            __typename: 'ConfigSystemConfigPostgres',
          },
          __typename: 'ConfigSystemConfig',
        },
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          postgres: {
            version: '14.15-20250311-rc2',
            resources: {
              storage: {
                capacity: 1,
                __typename: 'ConfigPostgresResourcesStorage',
              },
              enablePublicAccess: null,
              __typename: 'ConfigPostgresResources',
            },
            pitr: { retention: 7, __typename: 'ConfigPostgresPitr' },
            __typename: 'ConfigPostgres',
          },
        },
      }),
    ),
);

export const getPiTRNotEnabledPostgresSettings = nhostGraphQLLink.query(
  'GetPostgresSettings',
  (_req, res, ctx) =>
    res(
      ctx.data({
        systemConfig: {
          postgres: {
            database: 'gnlivtcgjxctuujxpslj',
            __typename: 'ConfigSystemConfigPostgres',
          },
          __typename: 'ConfigSystemConfig',
        },
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          postgres: {
            version: '14.15-20250311-rc2',
            resources: {
              storage: {
                capacity: 1,
                __typename: 'ConfigPostgresResourcesStorage',
              },
              enablePublicAccess: null,
              __typename: 'ConfigPostgresResources',
            },
            pitr: null,
            __typename: 'ConfigPostgres',
          },
        },
      }),
    ),
);

// {"data":}
