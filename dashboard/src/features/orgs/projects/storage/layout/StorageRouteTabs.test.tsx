import { useRouter } from 'next/router';
import { vi } from 'vitest';
import StorageRouteTabs from '@/features/orgs/projects/storage/layout/StorageRouteTabs';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const PROJECT_PATH = '/orgs/nhost/projects/dashboard';
const STORAGE_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/storage';

function setRoute(route: string, path: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: `${STORAGE_ROUTE}/${route}`,
    pathname: `${STORAGE_ROUTE}/${route}`,
    asPath: `${PROJECT_PATH}/storage/${path}`,
    query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('StorageRouteTabs', () => {
  it('marks Storage current on the bucket list', () => {
    setRoute('buckets', 'buckets');
    render(<StorageRouteTabs />);

    const storage = screen.getByRole('link', { name: 'Storage' });
    expect(storage).toHaveAttribute('href', `${PROJECT_PATH}/storage/buckets`);
    expect(storage).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('keeps Storage current on a bucket page', () => {
    setRoute('buckets/[...bucketId]', 'buckets/avatars');
    render(<StorageRouteTabs />);

    expect(screen.getByRole('link', { name: 'Storage' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('marks only Settings current on the settings page', () => {
    setRoute('settings', 'settings?tab=rate-limiting');
    render(<StorageRouteTabs />);

    const settings = screen.getByRole('link', { name: 'Settings' });
    expect(settings).toHaveAttribute(
      'href',
      `${PROJECT_PATH}/storage/settings`,
    );
    expect(settings).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Storage' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
