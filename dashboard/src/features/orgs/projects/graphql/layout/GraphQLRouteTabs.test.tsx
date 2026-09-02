import GraphQLRouteTabs from '@/features/orgs/projects/graphql/layout/GraphQLRouteTabs';
import { render, screen, within } from '@/tests/testUtils';

const settingsDisabled = vi.hoisted(() => ({ value: false }));
const router = vi.hoisted(() => ({
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql',
  query: {
    orgSlug: 'nhost',
    appSubdomain: 'dashboard',
  },
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/hooks/useSettingsDisabled', () => ({
  useSettingsDisabled: () => settingsDisabled.value,
}));

describe('GraphQLRouteTabs', () => {
  beforeEach(() => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/graphql';
    settingsDisabled.value = false;
  });

  it('renders GraphQL route tabs in product and settings order', () => {
    render(<GraphQLRouteTabs />);

    const nav = screen.getByRole('navigation', {
      name: 'GraphQL section navigation',
    });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Playground',
      'Remote Schemas',
      'Actions',
      'Metadata',
      'Settings',
    ]);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/graphql/settings',
    );
  });

  it('marks the active GraphQL route tab', () => {
    router.route =
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/remote-schemas/[remoteSchemaSlug]';

    render(<GraphQLRouteTabs />);

    expect(
      screen.getByRole('link', { name: 'Remote Schemas' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('disables the settings route when project settings are disabled', () => {
    settingsDisabled.value = true;

    render(<GraphQLRouteTabs />);

    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Settings')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
