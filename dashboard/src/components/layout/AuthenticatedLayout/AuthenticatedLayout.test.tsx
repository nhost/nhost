import { vi } from 'vitest';

import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout/AuthenticatedLayout';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

const push = vi.fn();
const useAuthMock = vi.fn();
const useIsHealthyMock = vi.fn();
const useIsPlatformMock = vi.fn();
const useOrgsMock = vi.fn();
const useProjectMock = vi.fn();

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { orgSlug: 'org-a', appSubdomain: 'project-a' },
    pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
    asPath: '/orgs/org-a/projects/project-a',
    push,
    isReady: true,
  }),
}));

vi.mock('@/providers/Auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/providers/Auth')>();

  return {
    ...actual,
    useAuth: () => useAuthMock(),
  };
});

vi.mock('@/features/orgs/projects/common/hooks/useIsHealthy', () => ({
  useIsHealthy: () => useIsHealthyMock(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => useIsPlatformMock(),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => useOrgsMock(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => useProjectMock(),
}));

vi.mock('@/components/layout/MainNav/TreeNavStateContext', () => ({
  useTreeNavState: () => ({ mainNavPinned: false }),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

beforeEach(() => {
  push.mockReset();
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  useIsPlatformMock.mockReturnValue(true);
  useIsHealthyMock.mockReturnValue({ isHealthy: true, isLoading: false });
  useAuthMock.mockReturnValue({
    isAuthenticated: false,
    isLoading: true,
    isSigningOut: false,
  });
  useOrgsMock.mockReturnValue({
    orgs: [],
    currentOrg: undefined,
    loading: true,
    error: null,
    refetch: vi.fn(),
  });
  useProjectMock.mockReturnValue({
    project: null,
    loading: true,
    error: null,
    refetch: vi.fn(),
    projectNotFound: false,
  });
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

describe('AuthenticatedLayout command palette mount', () => {
  it('renders the loading branch without throwing', () => {
    render(
      <AuthenticatedLayout>
        <div>Protected content</div>
      </AuthenticatedLayout>,
    );

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
