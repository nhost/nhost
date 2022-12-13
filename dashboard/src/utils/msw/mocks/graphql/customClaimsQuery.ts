import nhostGraphQLLink from './nhostGraphQLLink';

const customClaimsQuery = nhostGraphQLLink.query(
  'getAppCustomClaims',
  (_req, res, ctx) =>
    res(
      ctx.delay(250),
      ctx.data({
        app: {
          authJwtCustomClaims: {
            'Test-Id': 'test.id',
            'Sample-Id': 'sample.id',
          },
          id: 'app-id',
          name: 'app-name',
        },
      }),
    ),
);

export default customClaimsQuery;
