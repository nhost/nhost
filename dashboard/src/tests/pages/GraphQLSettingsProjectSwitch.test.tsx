import { ApolloProvider } from '@apollo/client';
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import GraphQLSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/graphql/settings';
import { createApolloClient } from '@/providers/Apollo/createApolloClient';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import {
  getOrganization,
  getOrganizations,
} from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import { getProjectStateQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { organizationMemberInvites } from '@/tests/msw/mocks/graphql/organizationRequests';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const SETTINGS_ROUTE =
  '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/settings';

const projectA = { ...mockApplication, githubRepository: null };
const projectB = {
  ...projectA,
  id: '2',
  name: 'Other project',
  slug: 'other-project',
  subdomain: 'other-project',
};

const httpPoolSizeByProject: Record<string, number> = {
  [projectA.id]: 150,
  [projectB.id]: 100,
};

const server = setupServer(
  tokenQuery,
  getOrganization,
  getOrganizations,
  getProjectStateQuery([{ stateId: ApplicationStatus.Live }]),
  organizationMemberInvites,
  nhostGraphQLLink.query('organizationNewRequests', () =>
    HttpResponse.json({ data: { organizationNewRequests: [] } }),
  ),
  nhostGraphQLLink.query('getAnnouncements', () =>
    HttpResponse.json({ data: { announcements: [] } }),
  ),
  nhostGraphQLLink.query('getProject', ({ variables }) =>
    HttpResponse.json({
      data: {
        apps: [projectA, projectB].filter(
          ({ subdomain }) => subdomain === variables.subdomain,
        ),
      },
    }),
  ),
  nhostGraphQLLink.query('getSoftwareVersions', () =>
    HttpResponse.json({ data: { softwareVersions: [] } }),
  ),
  nhostGraphQLLink.query('GetHasuraSettings', ({ variables }) =>
    HttpResponse.json({
      data: {
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          hasura: {
            __typename: 'ConfigHasura',
            version: 'v2.0.0',
            settings: {
              __typename: 'ConfigHasuraSettings',
              enableAllowList: false,
              enableRemoteSchemaPermissions: false,
              enableConsole: true,
              devMode: false,
              corsDomain: ['*'],
              enabledAPIs: ['metadata', 'graphql'],
              inferFunctionPermissions: true,
            },
            logs: { __typename: 'ConfigHasuraLogs', level: 'info' },
            events: {
              __typename: 'ConfigHasuraEvents',
              httpPoolSize: httpPoolSizeByProject[variables.appId],
            },
            resources: null,
          },
        },
      },
    }),
  ),
);

function openEngineSettings(subdomain: string) {
  mockRouter.pathname = SETTINGS_ROUTE;
  mockRouter.route = SETTINGS_ROUTE;
  mockRouter.asPath = `/orgs/${mockOrganization.slug}/projects/${subdomain}/graphql/settings?tab=engine`;
  mockRouter.query = {
    orgSlug: mockOrganization.slug,
    appSubdomain: subdomain,
    tab: 'engine',
  };
}

function GraphQLSettings({
  client,
}: {
  client: ReturnType<typeof createApolloClient>['client'];
}) {
  return (
    <ApolloProvider client={client}>
      {GraphQLSettingsPage.getLayout(<GraphQLSettingsPage />)}
    </ApolloProvider>
  );
}

function expectHttpPoolSize(value: number) {
  return waitFor(() =>
    expect(
      screen.getByRole('spinbutton', { name: 'HTTP Pool Size' }),
    ).toHaveValue(value),
  );
}

const originalRouter = { ...mockRouter, query: { ...mockRouter.query } };
const originalMatchMedia = window.matchMedia;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  mockScrollIntoViewAndPointerCapture();
});

afterEach(() => {
  queryClient.clear();
  Object.assign(mockRouter, originalRouter);
  vi.unstubAllEnvs();
  window.matchMedia = originalMatchMedia;
});

afterAll(() => server.close());

describe('GraphQL settings after switching projects', () => {
  it("shows the current project's HTTP pool size", async () => {
    const { client } = createApolloClient({
      graphqlUrl: 'https://local.graphql.local.nhost.run/v1',
      fetchPolicy: 'cache-and-network',
    });

    openEngineSettings(projectA.subdomain);
    const { rerender } = render(<GraphQLSettings client={client} />);
    await expectHttpPoolSize(150);

    openEngineSettings(projectB.subdomain);
    rerender(<GraphQLSettings client={client} />);
    await expectHttpPoolSize(100);

    openEngineSettings(projectA.subdomain);
    rerender(<GraphQLSettings client={client} />);
    await expectHttpPoolSize(150);
  });
});
