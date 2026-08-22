import {
  composeRequestHeaders,
  type GraphQLPlaygroundSelection,
} from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

const selection: GraphQLPlaygroundSelection = {
  userId: 'user-1',
  role: 'user',
};

describe('composeRequestHeaders', () => {
  it('composes the base and selector headers', () => {
    expect(
      composeRequestHeaders({ adminSecret: 'admin-secret', selection }),
    ).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
      'x-hasura-user-id': 'user-1',
      'x-hasura-role': 'user',
    });
  });

  it('omits empty selector headers', () => {
    expect(
      composeRequestHeaders({
        adminSecret: 'admin-secret',
        selection: { userId: '', role: '' },
      }),
    ).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
    });
  });

  it('normalizes Headers-tab overrides and lets them win', () => {
    expect(
      composeRequestHeaders({
        adminSecret: 'admin-secret',
        selection,
        headersTabOverrides: {
          'X-Hasura-Role': '',
          'X-Hasura-Admin-Secret': 'override-secret',
          'Content-Type': 'text/plain',
          Accept: 'text/plain',
          'X-Retry-Count': 3,
          'X-Custom-Null': null,
          'X-Custom-Undefined': undefined,
        },
      }),
    ).toEqual({
      'content-type': 'text/plain',
      'x-hasura-admin-secret': 'override-secret',
      'x-hasura-user-id': 'user-1',
      'x-hasura-role': '',
      'x-retry-count': '3',
    });
  });
});
