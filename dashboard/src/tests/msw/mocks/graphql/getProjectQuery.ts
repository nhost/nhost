/** biome-ignore-all lint/suspicious/noExplicitAny: mock file */

import { HttpResponse } from 'msw';
import type {
  GetProjectQuery,
  GetProjectQueryVariables,
  ProjectFragment,
} from '@/generated/graphql';
import { mockApplication } from '@/tests/mocks';
import nhostGraphQLLink from './nhostGraphQLLink';

interface GetProjectConfigErrorQueryOptions {
  healthyApplication: ProjectFragment;
  brokenSubdomain: string;
}

export const PROJECT_CONFIG_INCIDENT_ERROR_MESSAGE =
  'failed to resolve config: failed to validate config: config is not valid: #Config.functions.node.version: 2 errors in empty disjunction: (and 2 more errors)';

export const getProjectQuery = nhostGraphQLLink.query('getProject', () =>
  HttpResponse.json({
    data: {
      apps: [{ ...mockApplication, githubRepository: null }],
    },
  }),
);

export const getProjectConfigErrorQuery = ({
  healthyApplication,
  brokenSubdomain,
}: GetProjectConfigErrorQueryOptions) =>
  nhostGraphQLLink.query<GetProjectQuery, GetProjectQueryVariables>(
    'getProject',
    ({ variables }) =>
      variables.subdomain === brokenSubdomain
        ? HttpResponse.json({
            errors: [{ message: PROJECT_CONFIG_INCIDENT_ERROR_MESSAGE }],
          })
        : HttpResponse.json({ data: { apps: [healthyApplication] } }),
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
