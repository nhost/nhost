import { setupServer } from 'msw/node';
import OrganizationsCombobox from '@/components/layout/Header/OrganizationsCombobox';
import { prefetchNewAppQuery } from '@/tests/msw/mocks/graphql/prefetchNewAppQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

const push = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  query: { orgSlug: 'org-a' },
  pathname: '/orgs/[orgSlug]/projects',
  push,
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({
    orgs: [{ slug: 'org-a', name: 'Org A', plan: { name: 'Starter' } }],
    refetch: vi.fn(),
  }),
}));

const server = setupServer(tokenQuery, prefetchNewAppQuery);

describe('OrganizationsCombobox', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
    mockPointerEvent();
    push.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    server.close();
  });

  it('opens the create organization dialog from the footer', async () => {
    const user = new TestUserEvent();
    render(<OrganizationsCombobox />);

    await user.click(
      screen.getByRole('combobox', { name: 'Switch organization' }),
    );
    await user.click(
      await screen.findByRole('option', { name: /new organization/i }),
    );

    expect(
      await screen.findByRole('heading', { name: 'New Organization' }),
    ).toBeInTheDocument();
  });
});
