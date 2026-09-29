import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import SettingsGuard from './SettingsGuard';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));

function TestComponent() {
  return (
    <SettingsGuard>
      <h1>Settings loaded</h1>
    </SettingsGuard>
  );
}

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue(mockRouter);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('SettingsGuard', () => {
  it('renders its children on the platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');

    render(<TestComponent />);

    expect(screen.getByText('Settings loaded')).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('renders its children self-hosted when a config server is set', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', 'http://localhost:8080');

    render(<TestComponent />);

    expect(screen.getByText('Settings loaded')).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('redirects to 404 self-hosted without a config server', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');

    render(<TestComponent />);

    expect(screen.queryByText('Settings loaded')).not.toBeInTheDocument();
    expect(mockRouter.push).toHaveBeenCalledWith('/404');
  });
});
