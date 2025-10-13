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

export const getProjectStateQuery = (appStates?: any) =>
  nhostGraphQLLink.query('getProjectState', (_req, res, ctx) =>
    res(
      ctx.data({
        apps: [
          {
            ...mockApplication,
            appStates: appStates || mockApplication.appStates,
          },
        ],
      }),
    ),
  );

export const getNotFoundProjectStateQuery = nhostGraphQLLink.query(
  'getProjectState',
  (_req, res, ctx) =>
    res(
      ctx.data({
        apps: [],
      }),
    ),
);
