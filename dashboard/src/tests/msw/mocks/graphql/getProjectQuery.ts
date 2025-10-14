import { mockApplication } from '@/tests/mocks';
import { HttpResponse } from 'msw';
import nhostGraphQLLink from './nhostGraphQLLink';

export const getProjectQuery = nhostGraphQLLink.query('getProject', () =>
  HttpResponse.json({
    data: {
      apps: [{ ...mockApplication, githubRepository: null }],
    },
  }),
);

export const getProjectStateQuery = (appStates?: any) =>
  nhostGraphQLLink.query('getProjectState', () =>
    HttpResponse.json({
      data: {
        apps: [
          {
            ...mockApplication,
            appStates: appStates || mockApplication.appStates,
          },
        ],
      },
    }),
  );

export const getNotFoundProjectStateQuery = nhostGraphQLLink.query(
  'getProjectState',
  () =>
    HttpResponse.json({
      data: {
        apps: [],
      },
    }),
);
