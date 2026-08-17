import { vi } from 'vitest';
import { mockApplication } from '@/tests/mocks';
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

  test('renders subdomain and region with copy buttons during initialization', () => {
    mocks.useProject.mockReturnValue({
      project: mockApplication,
      loading: false,
    });

    render(<AppLoader startLoader={true} />);

    expect(
      screen.getByText(`Provisioning ${mockApplication.name}`),
    ).toBeInTheDocument();
    expect(screen.getByText('Subdomain')).toBeInTheDocument();
    expect(screen.getByText(mockApplication.subdomain)).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(
      screen.getByText(
        `${mockApplication.region.city} (${mockApplication.region.name})`,
      ),
    ).toBeInTheDocument();
  });
});
