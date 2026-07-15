import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { vi } from 'vitest';

import {
  CommandPaletteProvider,
  CommandPaletteTrigger,
} from '@/features/command-palette';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

const router = {
  query: { orgSlug: 'org-a', appSubdomain: 'project-a' },
  push: vi.fn(),
  isReady: true,
};

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({
    orgs: [],
    currentOrg: undefined,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
    projectNotFound: false,
  }),
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => true,
}));

beforeEach(() => {
  toast.remove();
  window.localStorage.clear();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('CommandPaletteTrigger', () => {
  it('renders the box variant with label and shortcut', () => {
    render(<CommandPaletteTrigger />);

    expect(screen.getByText('Search…')).toBeInTheDocument();
    expect(screen.getByText('Ctrl K')).toBeInTheDocument();
    expect(screen.getByLabelText('Open command palette')).toBeInTheDocument();
  });

  it('renders the macOS shortcut for Apple user agents', () => {
    const userAgent = vi
      .spyOn(window.navigator, 'userAgent', 'get')
      .mockReturnValue('Macintosh');

    render(<CommandPaletteTrigger />);

    expect(screen.getByText('⌘K')).toBeInTheDocument();
    userAgent.mockRestore();
  });

  it('renders the icon variant without a visible label', () => {
    render(<CommandPaletteTrigger variant="icon" />);

    expect(screen.getByLabelText('Open command palette')).toBeInTheDocument();
    expect(screen.queryByText('Search…')).not.toBeInTheDocument();
  });

  it('opens the palette and notifies the caller on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <CommandPaletteProvider>
        <CommandPaletteTrigger onClick={onClick} />
      </CommandPaletteProvider>,
    );

    await user.click(screen.getByLabelText('Open command palette'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByLabelText('Search dashboard'),
    ).toBeInTheDocument();
  });
});
