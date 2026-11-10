import { useEffect } from 'react';
import { vi } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import PlatformOnly from './PlatformOnly';

const mount = vi.fn();

function Child() {
  useEffect(() => {
    mount();
  }, []);

  return <span>Platform content</span>;
}

afterEach(() => {
  vi.unstubAllEnvs();
  mount.mockClear();
});

describe('PlatformOnly', () => {
  it('renders its children on the platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');

    render(
      <PlatformOnly>
        <Child />
      </PlatformOnly>,
    );

    expect(screen.getByText('Platform content')).toBeInTheDocument();
    expect(mount).toHaveBeenCalledOnce();
  });

  it('does not mount its children outside the platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');

    render(
      <PlatformOnly>
        <Child />
      </PlatformOnly>,
    );

    expect(screen.queryByText('Platform content')).not.toBeInTheDocument();
    expect(mount).not.toHaveBeenCalled();
  });
});
