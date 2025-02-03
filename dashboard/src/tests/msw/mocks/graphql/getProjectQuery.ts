import { mockApplication } from '@/tests/mocks';
import nhostGraphQLLink from './nhostGraphQLLink';

export const getProjectQuery = nhostGraphQLLink.query(
  'getProject',
  (_req, res, ctx) =>
    res(
      ctx.data({
        apps: [{ ...mockApplication, githubRepository: null }],
      }),
    ),
);
