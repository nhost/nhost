import { HttpResponse } from 'msw';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';

export const restoreApplicationDatabaseRequest: {
  variables?: Record<string, unknown>;
} = {};

export const restoreApplicationDatabase = nhostGraphQLLink.mutation(
  'RestoreApplicationDatabase',
  ({ variables }) => {
    restoreApplicationDatabaseRequest.variables = variables;

    return HttpResponse.json({
      data: {
        restoreApplicationDatabase: true,
      },
    });
  },
);
