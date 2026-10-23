import { ApolloProvider } from '@apollo/client';
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import DatabaseSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/settings';
import { createApolloClient } from '@/providers/Apollo/createApolloClient';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn() }));
vi.mock('next/router', async () => ({
  useRouter: mocks.useRouter,
  default: (await import('@/tests/mocks')).mockRouter,
}));

const SETTINGS_ROUTE =
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/settings';

function project(subdomain: string, name: string) {
  return {
    ...mockApplication,
    __typename: 'apps' as const,
    id: subdomain,
    name,
    slug: subdomain,
    subdomain,
    githubRepository: null,
    creator: null,
    appStates: [
      {
        id: `state-${subdomain}`,
        appId: subdomain,
        message: '',
        stateId: ApplicationStatus.Live,
        createdAt: '2026-08-11T00:00:00.000Z',
      },
    ],
  };
}

const projectA = project('project-a', 'Project A');
const projectB = project('project-b', 'Project B');
const projects = [projectA, projectB];

const allowedCIDRsByProject: Record<string, string[]> = {
  [projectA.id]: ['10.0.0.0/8'],
  [projectB.id]: ['192.168.0.0/16'],
};

const organization = {
  ...mockOrganization,
  apps: projects,
  members: [],
  plan: { ...mockOrganization.plan, slaLevel: 'none' },
};

let updateConfigVariables: unknown;

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query('getOrganizations', () =>
    HttpResponse.json({ data: { organizations: [organization] } }),
  ),
  nhostGraphQLLink.query('getOrganization', () =>
    HttpResponse.json({ data: { organizations: [organization] } }),
  ),
  nhostGraphQLLink.query('getProject', ({ variables }) =>
    HttpResponse.json({
      data: {
        apps: projects.filter(
          ({ subdomain }) => subdomain === variables.subdomain,
        ),
      },
    }),
  ),
  nhostGraphQLLink.query('getProjectState', ({ variables }) =>
    HttpResponse.json({
      data: {
        apps: projects.filter(
          ({ id, subdomain }) =>
            subdomain === variables.subdomain || id === variables.appId,
        ),
      },
    }),
  ),
  nhostGraphQLLink.query('getAnnouncements', () =>
    HttpResponse.json({ data: { announcements: [] } }),
  ),
  nhostGraphQLLink.query('organizationMemberInvites', () =>
    HttpResponse.json({ data: { organizationMemberInvites: [] } }),
  ),
  nhostGraphQLLink.query('organizationNewRequests', () =>
    HttpResponse.json({ data: { organizationNewRequests: [] } }),
  ),
  nhostGraphQLLink.query('GetPostgresSettings', ({ variables }) =>
    HttpResponse.json({
      data: {
        systemConfig: {
          __typename: 'ConfigSystemConfig',
          postgres: {
            __typename: 'ConfigSystemConfigPostgres',
            database: variables.appId,
          },
        },
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          postgres: {
            __typename: 'ConfigPostgres',
            version: '14.15-20250311-rc2',
            resources: {
              __typename: 'ConfigPostgresResources',
              storage: {
                __typename: 'ConfigPostgresResourcesStorage',
                capacity: 1,
              },
              enablePublicAccess: true,
              allowedCIDRs: allowedCIDRsByProject[variables.appId],
            },
            pitr: null,
          },
        },
      },
    }),
  ),
  nhostGraphQLLink.mutation('UpdateConfig', ({ variables }) => {
    updateConfigVariables = variables;

    return HttpResponse.json({
      data: {
        updateConfig: { id: 'ConfigConfig', __typename: 'ConfigConfig' },
      },
    });
  }),
);

function openAccessSettings(subdomain: string) {
  mockRouter.pathname = SETTINGS_ROUTE;
  mockRouter.route = SETTINGS_ROUTE;
  mockRouter.asPath = `/orgs/${organization.slug}/projects/${subdomain}/database/settings?tab=access`;
  mockRouter.query = {
    orgSlug: organization.slug,
    appSubdomain: subdomain,
    tab: 'access',
  };
}

function SettingsPage({
  client,
}: {
  client: ReturnType<typeof createApolloClient>['client'];
}) {
  return (
    <ApolloProvider client={client}>
      {DatabaseSettingsPage.getLayout(<DatabaseSettingsPage />)}
    </ApolloProvider>
  );
}

function expectAllowedCIDR(value: string) {
  return waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Allowed CIDR' })).toHaveValue(
      value,
    ),
  );
}

const originalRouter = { ...mockRouter, query: { ...mockRouter.query } };
const originalMatchMedia = window.matchMedia;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    ...mockMatchMediaValue(query),
    matches: true,
  }));
  mockScrollIntoViewAndPointerCapture();
  mocks.useRouter.mockReturnValue(mockRouter);
  updateConfigVariables = undefined;
});

afterEach(() => {
  queryClient.clear();
  Object.assign(mockRouter, originalRouter);
  mocks.useRouter.mockReset();
  vi.unstubAllEnvs();
  window.matchMedia = originalMatchMedia;
});

afterAll(() => server.close());

describe('Database settings after switching projects', () => {
  it("shows and saves only the current project's allowed CIDRs", async () => {
    const { client } = createApolloClient({
      graphqlUrl: 'https://local.graphql.local.nhost.run/v1',
      fetchPolicy: 'cache-and-network',
    });

    openAccessSettings(projectA.subdomain);
    const { rerender } = render(<SettingsPage client={client} />);
    await expectAllowedCIDR('10.0.0.0/8');

    openAccessSettings(projectB.subdomain);
    rerender(<SettingsPage client={client} />);
    await expectAllowedCIDR('192.168.0.0/16');

    openAccessSettings(projectA.subdomain);
    rerender(<SettingsPage client={client} />);
    await expectAllowedCIDR('10.0.0.0/8');

    const user = new TestUserEvent();
    const allowedCIDRsForm = within(
      screen.getByRole('heading', { name: 'Allowed CIDRs' }).closest('form')!,
    );
    await user.click(
      allowedCIDRsForm.getByRole('button', { name: 'Add CIDR' }),
    );
    await user.type(
      allowedCIDRsForm.getAllByRole('textbox', { name: 'Allowed CIDR' })[1],
      '172.16.0.0/12',
    );
    await user.click(allowedCIDRsForm.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateConfigVariables).toEqual({
        appId: projectA.id,
        config: {
          postgres: {
            resources: { allowedCIDRs: ['10.0.0.0/8', '172.16.0.0/12'] },
          },
        },
      }),
    );
  });
});
