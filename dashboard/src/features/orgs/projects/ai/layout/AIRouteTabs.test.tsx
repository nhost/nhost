import { useRouter } from 'next/router';
import { vi } from 'vitest';
import AIRouteTabs from '@/features/orgs/projects/ai/layout/AIRouteTabs';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const PROJECT_PATH = '/orgs/nhost/projects/dashboard';
const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';

function setRoute(route: string, path: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: `${PROJECT_ROUTE}/${route}`,
    pathname: `${PROJECT_ROUTE}/${route}`,
    asPath: `${PROJECT_PATH}/${path}`,
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

describe('AIRouteTabs', () => {
  it.each([
    ['Agents', 'ai/assistants'],
    ['File Stores', 'ai/file-stores'],
    ['Auto-Embeddings', 'ai/auto-embeddings'],
    ['Settings', 'ai/settings'],
  ])('marks only %s current on %s', (name, path) => {
    setRoute(path, path);
    render(<AIRouteTabs />);

    const tab = screen.getByRole('link', { name });
    expect(tab).toHaveAttribute('href', `${PROJECT_PATH}/${path}`);
    expect(screen.getAllByRole('link', { current: 'page' })).toEqual([tab]);
  });

  it('keeps every tab enabled off-platform when settings are enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', 'http://localhost:8080');
    setRoute('ai/settings', 'ai/settings');
    render(<AIRouteTabs />);

    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('disables every tab when settings are disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    setRoute('ai/assistants', 'ai/assistants');
    render(<AIRouteTabs />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    for (const name of [
      'Agents',
      'File Stores',
      'Auto-Embeddings',
      'Settings',
    ]) {
      expect(screen.getByText(name)).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
