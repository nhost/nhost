import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import { DatabaseSettingsNavigation } from '@/features/orgs/projects/database/settings/components/DatabaseSettingsNavigation';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

const SETTINGS_PATH = '/orgs/nhost/projects/dashboard/database/settings';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.mocked(useMediaQuery).mockReturnValue(true);
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    asPath: SETTINGS_PATH,
    query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('DatabaseSettingsNavigation', () => {
  it('links to each database settings section', () => {
    render(<DatabaseSettingsNavigation />);

    expect(
      screen
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Postgres version', `${SETTINGS_PATH}?tab=version`],
      ['Capacity', `${SETTINGS_PATH}?tab=capacity`],
      ['Point-in-Time Recovery', `${SETTINGS_PATH}?tab=point-in-time`],
      ['Access', `${SETTINGS_PATH}?tab=access`],
      ['Custom Domain', `${SETTINGS_PATH}?tab=custom-domain`],
      ['Reset password', `${SETTINGS_PATH}?tab=reset-password`],
    ]);
  });

  it('hides platform-only links and groups when self-hosted', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    render(<DatabaseSettingsNavigation />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['Postgres version', 'Capacity'],
    );
    expect(
      screen.getAllByRole('heading').map((heading) => heading.textContent),
    ).toEqual(['Engine', 'Storage']);
  });
});
