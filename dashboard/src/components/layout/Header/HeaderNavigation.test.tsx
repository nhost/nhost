import { vi } from 'vitest';
import HeaderNavigation from '@/components/layout/Header/HeaderNavigation';
import { render, screen } from '@/tests/testUtils';

const router = vi.hoisted(() => ({
  query: {} as { appSubdomain?: string },
}));
const useIsPlatformMock = vi.hoisted(() => vi.fn());

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => useIsPlatformMock(),
}));

vi.mock('@/components/layout/Header/OrgsComboBox', () => ({
  default: () => <div>Organization dropdown</div>,
}));

vi.mock('@/components/layout/Header/ProjectsComboBox', () => ({
  default: () => <div>Project dropdown</div>,
}));

describe('HeaderNavigation', () => {
  beforeEach(() => {
    router.query = {};
    useIsPlatformMock.mockReturnValue(true);
  });

  it('renders the project dropdown only when appSubdomain exists', () => {
    const { rerender } = render(<HeaderNavigation />);

    expect(screen.getByText('Organization dropdown')).toBeInTheDocument();
    expect(screen.queryByText('Project dropdown')).not.toBeInTheDocument();

    router.query = { appSubdomain: 'project-a' };
    rerender(<HeaderNavigation />);

    expect(screen.getByText('Project dropdown')).toBeInTheDocument();
  });

  it('hides header navigation on self-hosted dashboards', () => {
    useIsPlatformMock.mockReturnValue(false);

    render(<HeaderNavigation />);

    expect(screen.queryByText('Organization dropdown')).not.toBeInTheDocument();
    expect(screen.queryByText('Project dropdown')).not.toBeInTheDocument();
  });
});
