import { vi } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import AppLoader from './AppLoader';

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

describe('AppLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders loading screen when useProject is loading', () => {
    mocks.useProject.mockReturnValue({
      project: null,
      loading: true,
    });

    render(<AppLoader startLoader={true} />);

    expect(screen.queryByText(/Provisioning/i)).not.toBeInTheDocument();
  });

  test('renders provisioning status without subdomain and region when not provided', () => {
    mocks.useProject.mockReturnValue({
      project: {
        id: '1',
        name: 'My App',
        createdAt: new Date().toISOString(),
      },
      loading: false,
    });

    render(<AppLoader startLoader={true} />);

    expect(screen.getByText('Provisioning My App')).toBeInTheDocument();
    expect(screen.queryByText('Subdomain')).not.toBeInTheDocument();
    expect(screen.queryByText('Region')).not.toBeInTheDocument();
  });

  test('renders subdomain and region with copy buttons when available during initialization', () => {
    mocks.useProject.mockReturnValue({
      project: {
        id: '1',
        name: 'My App',
        subdomain: 'my-app-subdomain',
        region: {
          name: 'eu-central-1',
          domain: 'eu-central-1.nhost.run',
        },
        createdAt: new Date().toISOString(),
      },
      loading: false,
    });

    render(<AppLoader startLoader={true} />);

    expect(screen.getByText('Provisioning My App')).toBeInTheDocument();
    expect(screen.getByText('Subdomain')).toBeInTheDocument();
    expect(screen.getByText('my-app-subdomain')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('eu-central-1')).toBeInTheDocument();
  });
});
