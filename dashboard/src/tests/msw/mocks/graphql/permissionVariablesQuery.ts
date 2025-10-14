import { HttpResponse } from 'msw';
import nhostGraphQLLink from './nhostGraphQLLink';

const permissionVariablesQuery = nhostGraphQLLink.query(
  'GetRolesPermissions',
  async () =>
    HttpResponse.json({
      data: {
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
      },
    }),
);

export default permissionVariablesQuery;
