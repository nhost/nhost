import nhostGraphQLLink from './nhostGraphQLLink';

const permissionVariablesQuery = nhostGraphQLLink.query(
  'GetRolesPermissions',
  (_req, res, ctx) =>
    res(
      ctx.delay(250),
      ctx.data({
        config: {
          auth: {
            user: {
              roles: {
                allowed: ['user', 'me'],
                default: 'user',
              },
            },
            session: {
              accessToken: {
                customClaims: [
                  {
                    id: 'Test-Id',
                    key: 'Test-Id',
                    value: 'test.id',
                  },
                  {
                    id: 'Sample-Id',
                    key: 'Sample-Id',
                    value: 'sample.id',
                  },
                ],
              },
            },
          },
        },
      }),
    ),
);

export default permissionVariablesQuery;
