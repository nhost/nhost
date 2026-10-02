/** biome-ignore-all lint/suspicious/noExplicitAny: mock file */

import { HttpResponse } from 'msw';
import { mockApplication } from '@/tests/mocks';
import nhostGraphQLLink from './nhostGraphQLLink';

export const getProjectQuery = nhostGraphQLLink.query('getProject', () =>
  HttpResponse.json({
    data: {
      apps: [{ ...mockApplication, githubRepository: null }],
    },
  }),
);

export const getProjectStateQuery = (
  appStates?: any,
  overrides?: Partial<typeof mockApplication>,
) =>
  nhostGraphQLLink.query('getProjectState', () =>
    HttpResponse.json({
      data: {
        apps: [
          {
            ...mockApplication,
            ...overrides,
            appStates:
              appStates ?? overrides?.appStates ?? mockApplication.appStates,
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
